import { describe, expect, it } from 'vitest';
import { currentSeason, formatSeasons, suggestSeasons } from './seasons';

describe('currentSeason', () => {
  it.each([
    ['2026-02-28', 'winter'],
    ['2026-03-01', 'spring'],
    ['2026-05-31', 'spring'],
    ['2026-06-01', 'summer'],
    ['2026-08-31', 'summer'],
    ['2026-09-28', 'autumn'],
    ['2026-11-30', 'autumn'],
    ['2026-12-01', 'winter'],
    ['2027-01-15', 'winter'],
  ])('%s → %s', (day, season) => {
    expect(currentSeason(new Date(`${day}T12:00:00`))).toBe(season);
  });
});

describe('suggestSeasons', () => {
  it('reconnaît les saisons en français, sans accents et en anglais', () => {
    expect(suggestSeasons(['courge', 'automn', 'automne', 'winter', 'hiver'])).toEqual([
      'autumn',
      'winter',
    ]);
    expect(suggestSeasons(['Été', 'barbecue'])).toEqual(['summer']);
    expect(suggestSeasons(['recette printanière'])).toEqual(['spring']);
  });

  it('ne se déclenche pas sur un mot qui contient une saison', () => {
    expect(suggestSeasons(['indien', 'rapide', 'étendre', 'arrêté'])).toEqual([]);
  });
});

describe('formatSeasons', () => {
  it('affiche dans l’ordre de l’année, ou « Toute l’année »', () => {
    expect(formatSeasons(['winter', 'autumn'])).toBe('Automne · Hiver');
    expect(formatSeasons(['summer', 'winter', 'spring', 'autumn'])).toBe('Toute l’année');
    expect(formatSeasons([])).toBe('');
  });
});
