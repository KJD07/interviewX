"""Spread verified prospects over weekdays and write the schedule.

Usage: python3 -I build_schedule.py prospects.csv validation.txt START_DATE DAYS [PER_DAY] [HH:MM_IST] [GAP_MIN]
  prospects.csv : college,email,city,source
  validation.txt: "<email> validated|not_validated" per line (Apollo results)
  START_DATE    : first send day, YYYY-MM-DD (weekends are skipped)
Writes schedule.json next to prospects.csv: [{day, at (UTC ISO), college, email, city}].
Only "validated" emails are scheduled. Sources alternate so each day mixes regions.
"""
import csv, datetime as dt, json, os, sys


def main(prospects, validation, start, days, per_day=None, hhmm='11:10', gap=3):
    ok = {l.split()[0] for l in open(validation) if l.split()[1:] == ['validated']}
    rows = [r for r in csv.DictReader(open(prospects)) if r['email'] in ok]
    a = [r for r in rows if r.get('source') != 'equip.co']
    b = [r for r in rows if r.get('source') == 'equip.co']
    mix = []
    while a or b:
        if a: mix.append(a.pop(0))
        if b: mix.append(b.pop(0))
    days = int(days)
    per_day = int(per_day) if per_day else -(-len(mix) // days)
    h, m = map(int, hhmm.split(':'))
    d = dt.date.fromisoformat(start)
    out, k = [], 0
    for _ in range(days):
        while d.weekday() >= 5:
            d += dt.timedelta(days=1)
        base = dt.datetime(d.year, d.month, d.day, h, m) - dt.timedelta(hours=5, minutes=30)  # IST -> UTC
        for j in range(per_day):
            if k >= len(mix): break
            r = mix[k]; k += 1
            out.append({'day': d.isoformat(), 'at': (base + dt.timedelta(minutes=gap * j)).strftime('%Y-%m-%dT%H:%M:%SZ'),
                        'college': r['college'], 'email': r['email'], 'city': r.get('city', '')})
        d += dt.timedelta(days=1)
    path = os.path.join(os.path.dirname(os.path.abspath(prospects)), 'schedule.json')
    json.dump(out, open(path, 'w'), indent=1)
    print(f'{len(out)} scheduled ({len(rows)} validated, {len(mix) - len(out)} left over) -> {path}')
    for o in out:
        print(o['at'], o['email'], '|', o['college'])


if __name__ == '__main__':
    main(*sys.argv[1:])
