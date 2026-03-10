import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCb);

const SERVICE_NAME = 'runcontext';

/**
 * Escape a string for safe interpolation into a single-quoted PowerShell string.
 * PowerShell single-quoted strings only need single quotes escaped (by doubling them).
 */
function escapePowerShellString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * OS keychain abstraction. Shells out to platform-specific credential tools.
 * - macOS: `security` (Keychain Services)
 * - Linux: `secret-tool` (libsecret / GNOME Keyring)
 * - Windows: PowerShell `*-StoredCredential` cmdlets
 *
 * Falls back gracefully — all methods return null/false on failure.
 */
export class Keychain {
  private readonly platform = process.platform;

  /** Check if the OS keychain is available. */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.platform === 'darwin') {
        await execFileAsync('security', ['list-keychains']);
        return true;
      }
      if (this.platform === 'linux') {
        await execFileAsync('which', ['secret-tool']);
        return true;
      }
      if (this.platform === 'win32') {
        await execFileAsync('powershell', [
          '-Command',
          'Get-Command Get-StoredCredential -ErrorAction Stop',
        ]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /** Get a credential from the keychain. Returns null if not found. */
  async get(account: string): Promise<string | null> {
    try {
      if (this.platform === 'darwin') {
        const { stdout } = await execFileAsync('security', [
          'find-generic-password',
          '-s', SERVICE_NAME,
          '-a', account,
          '-w', // output password only
        ]);
        return stdout.trim() || null;
      }

      if (this.platform === 'linux') {
        const { stdout } = await execFileAsync('secret-tool', [
          'lookup',
          'service', SERVICE_NAME,
          'account', account,
        ]);
        return stdout.trim() || null;
      }

      if (this.platform === 'win32') {
        const { stdout } = await execFileAsync('powershell', [
          '-Command',
          `(Get-StoredCredential -Target '${escapePowerShellString(SERVICE_NAME)}:${escapePowerShellString(account)}').GetNetworkCredential().Password`,
        ]);
        return stdout.trim() || null;
      }

      return null;
    } catch {
      return null;
    }
  }

  /** Store a credential in the keychain. */
  async set(account: string, password: string): Promise<void> {
    try {
      if (this.platform === 'darwin') {
        // Delete existing entry first (ignore errors)
        try {
          await execFileAsync('security', [
            'delete-generic-password',
            '-s', SERVICE_NAME,
            '-a', account,
          ]);
        } catch {
          /* not found — ok */
        }

        await execFileAsync('security', [
          'add-generic-password',
          '-s', SERVICE_NAME,
          '-a', account,
          '-w', password,
        ]);
        return;
      }

      if (this.platform === 'linux') {
        const proc = execFileCb('secret-tool', [
          'store',
          '--label', `RunContext: ${account}`,
          'service', SERVICE_NAME,
          'account', account,
        ]);
        proc.stdin?.write(password);
        proc.stdin?.end();
        await new Promise<void>((resolve, reject) => {
          proc.on('close', (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`secret-tool exited ${code}`)),
          );
        });
        return;
      }

      if (this.platform === 'win32') {
        await execFileAsync('powershell', [
          '-Command',
          `New-StoredCredential -Target '${escapePowerShellString(SERVICE_NAME)}:${escapePowerShellString(account)}' -UserName '${escapePowerShellString(account)}' -Password '${escapePowerShellString(password)}' -Type Generic -Persist LocalMachine`,
        ]);
        return;
      }
    } catch {
      // Swallow errors — keychain write failures should not crash the caller
    }
  }

  /** Delete a credential from the keychain. */
  async delete(account: string): Promise<void> {
    try {
      if (this.platform === 'darwin') {
        await execFileAsync('security', [
          'delete-generic-password',
          '-s', SERVICE_NAME,
          '-a', account,
        ]);
      } else if (this.platform === 'linux') {
        await execFileAsync('secret-tool', [
          'clear',
          'service', SERVICE_NAME,
          'account', account,
        ]);
      } else if (this.platform === 'win32') {
        await execFileAsync('powershell', [
          '-Command',
          `Remove-StoredCredential -Target '${escapePowerShellString(SERVICE_NAME)}:${escapePowerShellString(account)}'`,
        ]);
      }
    } catch {
      // Ignore — credential may not exist
    }
  }
}
