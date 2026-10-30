"""Download pages and pull out placement/TPO email addresses.

Usage: python3 -I extract_emails.py urls.txt out_dir
  urls.txt: one URL per line (college placement/contact pages, equip.co list, ...)
Prints one line per page: index, host, role emails found (or other emails if none).
Also writes out_dir/emails.csv (url, email). Handles Cloudflare-obfuscated
emails (data-cfemail) and "[at]/[dot]" spelling. Free-mail addresses
(gmail/yahoo/...) are listed but should not be used for outreach.
"""
import csv, html, os, re, subprocess, sys

ROLE = re.compile(r'plac|tpo|tnp|t&p|train|career|corporate|cdc|crc|recruit|tap|cgpc|cpo', re.I)
JUNK = re.compile(r'\.(png|jpg|jpeg|gif|svg|webp|js|css)$|sentry|example|wixpress', re.I)
EMAIL = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'


def cf(h):
    k = int(h[:2], 16)
    return ''.join(chr(int(h[i:i + 2], 16) ^ k) for i in range(2, len(h), 2))


def emails_in(text):
    t = html.unescape(text)
    found = set(re.findall(EMAIL, t))
    found |= {cf(h) for h in re.findall(r'data-cfemail="([0-9a-f]+)"', t)}
    found |= {cf(h) for h in re.findall(r'email-protection#([0-9a-f]+)', t)}
    t2 = re.sub(r'\s*[\[(]\s*at\s*[\])]\s*', '@', t)
    t2 = re.sub(r'\s*[\[(]\s*dot\s*[\])]\s*', '.', t2)
    found |= set(re.findall(EMAIL, t2))
    return {e.strip('.').lower() for e in found if not JUNK.search(e)}


def main(urls_file, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    urls = [u.strip() for u in open(urls_file) if u.strip()]
    rows = []
    for i, u in enumerate(urls, 1):
        p = os.path.join(out_dir, f'p{i}.html')
        subprocess.run(['curl', '-sL', '-m', '20', '-A', 'Mozilla/5.0', u, '-o', p])
        if not os.path.exists(p):
            print(i, u, '| (fetch failed)')
            continue
        found = emails_in(open(p, errors='ignore').read())
        keep = sorted(e for e in found if ROLE.search(e))
        host = u.split('/')[2]
        print(i, host, '|', ', '.join(keep) if keep else '(none) ' + ', '.join(sorted(found))[:200])
        rows += [(u, e) for e in keep]
    with open(os.path.join(out_dir, 'emails.csv'), 'w', newline='') as f:
        csv.writer(f).writerows([('url', 'email')] + rows)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
