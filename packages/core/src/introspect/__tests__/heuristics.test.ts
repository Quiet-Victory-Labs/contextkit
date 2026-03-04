import { describe, it, expect } from 'vitest';
import {
  inferTableType,
  inferGrain,
  inferSemanticRole,
  inferAggregation,
} from '../heuristics.js';
import type { ColumnInfo } from '../../adapters/types.js';

describe('inferTableType', () => {
  it('views starting with vw_ are view', () => {
    expect(inferTableType('vw_coffee_shops', 'view', [])).toBe('view');
  });

  it('tables with date column and no PK are event', () => {
    const cols: ColumnInfo[] = [
      { name: 'dispatch_date', data_type: 'DATE', nullable: false, is_primary_key: false },
      { name: 'category', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('crime_incidents', 'table', cols)).toBe('event');
  });

  it('tables with single PK and mostly text are dimension', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'name', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
      { name: 'city', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('yelp_business', 'table', cols)).toBe('dimension');
  });

  it('tables with numeric columns and FK-looking cols are fact', () => {
    const cols: ColumnInfo[] = [
      { name: 'review_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: false },
      { name: 'stars', data_type: 'DOUBLE', nullable: true, is_primary_key: false },
      { name: 'useful', data_type: 'INTEGER', nullable: true, is_primary_key: false },
    ];
    expect(inferTableType('yelp_reviews', 'table', cols)).toBe('fact');
  });
});

describe('inferGrain', () => {
  it('single PK produces readable grain', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'name', data_type: 'VARCHAR', nullable: true, is_primary_key: false },
    ];
    expect(inferGrain('yelp_business', cols)).toBe(
      'one row per yelp_business identified by business_id',
    );
  });

  it('composite PK lists all key columns', () => {
    const cols: ColumnInfo[] = [
      { name: 'business_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
      { name: 'user_id', data_type: 'VARCHAR', nullable: false, is_primary_key: true },
    ];
    expect(inferGrain('yelp_tips', cols)).toBe(
      'one row per unique combination of business_id, user_id',
    );
  });

  it('no PK produces fallback grain', () => {
    const cols: ColumnInfo[] = [
      { name: 'lat', data_type: 'DOUBLE', nullable: true, is_primary_key: false },
    ];
    expect(inferGrain('events', cols)).toBe(
      'one row per record (no primary key detected)',
    );
  });
});

describe('inferSemanticRole', () => {
  it('_id columns are identifier', () => {
    expect(inferSemanticRole('business_id', 'VARCHAR', true)).toBe('identifier');
  });

  it('PK columns are identifier', () => {
    expect(inferSemanticRole('geoid', 'VARCHAR', true)).toBe('identifier');
  });

  it('numeric columns with metric-like names are metric', () => {
    expect(inferSemanticRole('review_count', 'INTEGER', false)).toBe('metric');
    expect(inferSemanticRole('total_population', 'INTEGER', false)).toBe('metric');
    expect(inferSemanticRole('pct_renter_occupied', 'DOUBLE', false)).toBe('metric');
  });

  it('date/timestamp columns are date', () => {
    expect(inferSemanticRole('created_at', 'TIMESTAMP', false)).toBe('date');
    expect(inferSemanticRole('dispatch_date', 'DATE', false)).toBe('date');
  });

  it('everything else is dimension', () => {
    expect(inferSemanticRole('name', 'VARCHAR', false)).toBe('dimension');
    expect(inferSemanticRole('city', 'VARCHAR', false)).toBe('dimension');
  });
});

describe('inferAggregation', () => {
  it('count/total columns get SUM', () => {
    expect(inferAggregation('review_count')).toBe('SUM');
    expect(inferAggregation('total_population')).toBe('SUM');
  });

  it('avg/pct/rate columns get AVG', () => {
    expect(inferAggregation('avg_stars')).toBe('AVG');
    expect(inferAggregation('pct_renter_occupied')).toBe('AVG');
    expect(inferAggregation('demand_signal_rate')).toBe('AVG');
    expect(inferAggregation('median_household_income')).toBe('AVG');
  });

  it('fallback is SUM', () => {
    expect(inferAggregation('amount')).toBe('SUM');
  });
});
