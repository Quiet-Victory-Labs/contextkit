import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Keychain } from './keychain.js';
import type { StoredCredential } from './types.js';

const CREDS_DIR = path.join(os.homedir(), '.runcontext');
const CREDS_FILE = path.join(CREDS_DIR, 'credentials.json');

interface CredentialsFile {
  cloud?: Record<string, unknown>;
  databases?: Record<string, StoredCredential>;
}

/**
 * Credential store with OS keychain primary and file fallback.
 * Tokens are stored in keychain when available; full metadata always
 * goes in the file (non-secret fields like provider, key, expiresAt).
 */
export class CredentialStore {
  private keychain = new Keychain();
  private keychainAvailable: boolean | null = null;

  private async useKeychain(): Promise<boolean> {
    if (this.keychainAvailable === null) {
      this.keychainAvailable = await this.keychain.isAvailable();
    }
    return this.keychainAvailable;
  }

  /** Save a credential. Token goes to keychain if available; metadata to file. */
  async save(cred: StoredCredential): Promise<void> {
    if (await this.useKeychain()) {
      // Store token in keychain
      if (cred.token) {
        await this.keychain.set(cred.key, cred.token);
      }
      // Store metadata (without token) in file
      const { token, refreshToken, ...metadata } = cred;
      this.writeToFile(cred.key, metadata as StoredCredential);
    } else {
      // No keychain — store everything in file
      this.writeToFile(cred.key, cred);
    }
  }

  /** Load a credential by key. Merges keychain token with file metadata. */
  async load(key: string): Promise<StoredCredential | null> {
    const file = this.readFile();
    const entry = file.databases?.[key];
    if (!entry) return null;

    if (await this.useKeychain()) {
      const token = await this.keychain.get(key);
      return { ...entry, token: token ?? entry.token };
    }

    return entry;
  }

  /** Remove a credential from both keychain and file. */
  async remove(key: string): Promise<void> {
    if (await this.useKeychain()) {
      await this.keychain.delete(key);
    }

    const file = this.readFile();
    if (file.databases?.[key]) {
      delete file.databases[key];
      this.saveFile(file);
    }
  }

  /** List all stored credential keys. */
  async list(): Promise<string[]> {
    const file = this.readFile();
    return Object.keys(file.databases ?? {});
  }

  // -- File helpers --

  private readFile(): CredentialsFile {
    try {
      if (!fs.existsSync(CREDS_FILE)) return {};
      return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf-8'));
    } catch {
      return {};
    }
  }

  private saveFile(data: CredentialsFile): void {
    if (!fs.existsSync(CREDS_DIR)) {
      fs.mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  private writeToFile(key: string, cred: StoredCredential): void {
    const file = this.readFile();
    file.databases = file.databases ?? {};
    file.databases[key] = cred;
    this.saveFile(file);
  }
}
