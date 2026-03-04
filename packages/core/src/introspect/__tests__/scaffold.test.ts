import { describe, it, expect } from 'vitest';
import { scaffoldFromSchema } from '../scaffold.js';
import type { TableInfo, ColumnInfo } from '../../adapters/types.js';

const tables: TableInfo[] = [
  { name: 'users', type: 'table', schema: 'main', row_count: 100 },
  { name: 'vw_active', type: 'view', schema: 'main', row_count: 80 },
];

const columns: Record<string, ColumnInfo[]> = {
  users: [
    { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: true },
    { name: 'name', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
    { name: 'created_at', data_type: 'TIMESTAMP', nullable: true, is_primary_key: false },
  ],
  vw_active: [
    { name: 'user_id', data_type: 'INTEGER', nullable: false, is_primary_key: false },
    { name: 'name', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
  ],
};

describe('scaffoldFromSchema', () => {
  it('generates OSI model YAML', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.osiYaml).toContain('name: test-model');
    expect(result.osiYaml).toContain('name: users');
    expect(result.osiYaml).toContain('name: vw_active');
    expect(result.osiYaml).toContain('name: user_id');
    expect(result.osiYaml).toContain('data_source: warehouse');
  });

  it('generates governance YAML with grain and table_type', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.governanceYaml).toContain('model: test-model');
    expect(result.governanceYaml).toContain('owner: default-team');
    expect(result.governanceYaml).toContain('security: internal');
    expect(result.governanceYaml).toContain('grain:');
    expect(result.governanceYaml).toContain('table_type:');
  });

  it('generates owner YAML', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.ownerYaml).toContain('id: default-team');
    expect(result.ownerYaml).toContain('display_name: Default Team');
  });

  it('returns file names', () => {
    const result = scaffoldFromSchema({
      modelName: 'test-model',
      dataSourceName: 'warehouse',
      tables,
      columns,
    });
    expect(result.files.osi).toBe('test-model.osi.yaml');
    expect(result.files.governance).toBe('test-model.governance.yaml');
    expect(result.files.owner).toBe('default-team.owner.yaml');
  });
});
