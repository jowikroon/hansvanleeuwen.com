import os
import sys
import json
import re
import csv
import glob
import urllib.request
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

# Remove proxies
for k in list(os.environ.keys()):
    if 'proxy' in k.lower():
        del os.environ[k]

HOME = os.path.expanduser("~")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_FILE = os.path.normpath(os.path.join(SCRIPT_DIR, "..", "src", "data", "attachmentsCatalog.json"))

def get_service_key():
    key = os.environ.get("SUPABASE_MG_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
    if key:
        return key
    for path in [
        os.path.join(HOME, r"Documents\Hans\env\everything.env"),
        os.path.normpath(os.path.join(SCRIPT_DIR, "..", ".env")),
        os.path.join(HOME, r"Documents\SecondBrainVault\_skill\adapters\.env")
    ]:
        if os.path.exists(path):
            try:
                env_map = {}
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            env_map[k.strip()] = v.strip().strip("\"'")
                for candidate in ["SUPABASE_MG_SERVICE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_KEY"]:
                    if candidate in env_map and env_map[candidate].startswith("eyJ"):
                        return env_map[candidate]
            except Exception:
                pass
    return ""

SERVICE_KEY = get_service_key()
SUPABASE_URL = "https://pesfakewujjwkyybwaom.supabase.co/rest/v1"

def req_supabase(endpoint):
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    req = urllib.request.Request(f"{SUPABASE_URL}/{endpoint}", headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error querying {endpoint}: {e}")
        return []

def format_size(size_bytes):
    if not size_bytes:
        return "N/A"
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024*1024):.1f} MB"
    else:
        return f"{size_bytes / (1024*1024*1024):.2f} GB"

def sanitize_local_path(p):
    if not p:
        return None
    user_home = os.path.expanduser("~")
    if user_home and user_home in p:
        return p.replace(user_home, "%USERPROFILE%")
    return p

def extract_base_title(name):
    # Remove file extension
    s = os.path.splitext(name)[0]
    # Remove leading track codes like 'A1 ', 'B2 ', 'S01 ', '##'
    s = re.sub(r'^(##|[A-Z0-9]{2,3}\s+)', '', s)
    # Remove artist prefixes
    s = re.sub(r'\b(jowikroon|hansvanleeuwen)\s*-\s*', '', s, flags=re.I)
    # Remove 'Kopie van ' or 'Copy of '
    s = re.sub(r'^(Kopie van|Copy of)\s+', '', s, flags=re.I)
    # Remove brackets with IDs like [679a03c3]
    s = re.sub(r'\[[a-f0-9]{8}\]', '', s, flags=re.I)
    # Strip versions in parentheses like (1), (2), (Remastered x3), (Remastered)
    s = re.sub(r'\((Remastered(\s*x\d+)?|\d+)\)', '', s, flags=re.I)
    # Remove trailing master annotations
    s = re.sub(r'\s*-\s*(NEON master|Clean Master|Mastered|Restored|Mix|Stem Mix).*$', '', s, flags=re.I)
    s = re.sub(r'\s+', ' ', s).strip(' -_.')
    return s if s else os.path.splitext(name)[0]

def detect_quality(name, details=""):
    full = f"{name} {details}".lower()
    if any(k in full for k in ["neuralanalog", "apollo", "universal enhancer", "universr", "flashsr", "dacvae", "denoise", "na mastered"]):
        if "-14 lufs" in full: return "NeuralAnalog (-14 LUFS)"
        if "-12 lufs" in full: return "NeuralAnalog (-12 LUFS)"
        if "-8 lufs" in full: return "NeuralAnalog (-8 LUFS)"
        if "-9.5 lufs" in full: return "NeuralAnalog (-9.5 LUFS)"
        return "NeuralAnalog (Studio AI)"
    if any(k in full for k in ["neon master", "96k-24bit", "96k 24-bit", "comb-flattener", "lp master"]):
        return "LP Master (Comb-Flattener 96k/24b)"
    if "mixea" in full:
        return "Mixea Master"
    if "atmos" in full:
        return "Dolby Atmos"
    if "clean master" in full:
        return "Clean Master (Hi-Res)"
    if any(k in full for k in ["stem mix", "instrumental", "stems"]):
        return "Stem Mix / Instrumental"
    if "mastered" in full:
        return "Mastered"
    if "mix" in full:
        return "Mix / Arrangement"
    return "Origineel / Versie"

def detect_song(name):
    # Match against known songs
    known_songs = [
        "Around the Neon World", "Beat Between Our Years", "Beat Drop", "Beat in the Back of Me",
        "Clown with you", "Digital Control", "E = 2", "Eentje eentje met god erin", "Endless white room",
        "Find Your Inner Rebel", "First Weird Step", "Grace is reaching Back", "Hanging On",
        "Hellogoodbye", "Here In Your Arms", "Hey Dreamer", "I Hear You There", "I Was Listening",
        "Keep walking", "Kilokorting Hemel", "Level Four", "Level One", "Mijn opa weet alles",
        "Neon God", "Neon House of Glass", "Neon Luftballoons", "New Level", "No More Silence",
        "Nothing left to choose", "Pressure", "Serotonin Carousel", "Teacher Leave", "That Spark",
        "The Beat is on Me", "The Vow I'm Holding", "Two lines", "With a grin", "Dancin'"
    ]
    name_low = name.lower()
    for s in known_songs:
        if s.lower() in name_low:
            return s
    return None

def detect_version_label(filename):
    # Try finding version in string
    m = re.search(r'\bv?(\d+(\.\d+)?)\b', filename, re.I)
    v_num = m.group(1) if m else None
    
    if "neon master" in filename.lower():
        return "LP Master (96k/24b)"
    if "neuralanalog" in filename.lower() or "na mastered" in filename.lower():
        if "-12 lufs" in filename.lower(): return "NeuralAnalog (-12 LUFS)"
        if "-14 lufs" in filename.lower(): return "NeuralAnalog (-14 LUFS)"
        if "-8 lufs" in filename.lower(): return "NeuralAnalog (-8 LUFS)"
        return "NeuralAnalog Master"
    if "clean master a" in filename.lower():
        return "Clean Master A (Thunder repaired)"
    if "clean master b" in filename.lower():
        return "Clean Master B (From source)"
    if "remastered x4" in filename.lower():
        return "Remastered x4"
    if "remastered x3" in filename.lower():
        return "Remastered x3"
    if "remastered x2" in filename.lower():
        return "Remastered x2"
    if "remastered" in filename.lower():
        return "Remastered"
    if "mastered" in filename.lower():
        return "Mastered"
    if "stem mix" in filename.lower():
        return "Stem Mix"
    if "mix" in filename.lower():
        return "Mix"
    if v_num:
        return f"v{v_num}"
    if "kopie" in filename.lower() or "copy" in filename.lower():
        return "Kopie / Tweede versie"
    return "Origineel (v1)"

all_versions = []

# ==========================================
# 1. HARVEST HVL: Google Drive Deep Research PDFs
# ==========================================
print("📂 Inlezen HVL: Google Drive Deep Research PDFs...")
DRIVE_DIR = os.path.join(HOME, r"Downloads\GoogleDrive_DeepResearch_PDFs")
doc_id_by_path = {}
reg_path = os.path.join(DRIVE_DIR, "download_registry.json")
if os.path.exists(reg_path):
    try:
        with open(reg_path, 'r', encoding='utf-8') as rf:
            raw_reg = json.load(rf)
            for d_id, p in raw_reg.items():
                doc_id_by_path[os.path.normpath(p).lower()] = d_id
                doc_id_by_path[os.path.basename(p).lower()] = d_id
        print(f"Loaded {len(raw_reg)} Google Doc ID mappings from download_registry.json")
    except Exception as e:
        print(f"Error loading registry: {e}")

if os.path.exists(DRIVE_DIR):
    for root, dirs, files in os.walk(DRIVE_DIR):
        for f in files:
            if f.lower().endswith(".pdf"):
                fp = os.path.join(root, f)
                rel = os.path.relpath(root, DRIVE_DIR)
                cat = "Deep Research" if rel == "." else rel
                sz = os.path.getsize(fp)
                mtime = os.path.getmtime(fp)
                date_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
                
                # Check for doc_id from registry
                doc_id = doc_id_by_path.get(os.path.normpath(fp).lower()) or doc_id_by_path.get(f.lower())
                preview_url = f"https://docs.google.com/document/d/{doc_id}/preview" if doc_id else None
                external_url = f"https://docs.google.com/document/d/{doc_id}/edit" if doc_id else None
                
                all_versions.append({
                    "id": f"hvl-gdoc-{len(all_versions)}",
                    "file_name": f,
                    "title": os.path.splitext(f)[0],
                    "base_title": extract_base_title(f),
                    "channel": "hansvanleeuwen",
                    "category": "Deep Research (Google Drive)",
                    "file_type": "gdoc" if doc_id else "pdf",
                    "file_size_bytes": sz,
                    "size_formatted": format_size(sz),
                    "quality": "Document PDF (Google Doc)" if doc_id else "Document PDF",
                    "version_label": detect_version_label(f),
                    "created_at": date_str,
                    "local_path": sanitize_local_path(fp),
                    "google_doc_id": doc_id,
                    "preview_url": preview_url,
                    "external_url": external_url,
                    "stream_url": None,
                    "tags": ["deep-research", "google-docs", "pdf", "gdoc"]
                })

# ==========================================
# 2. HARVEST HVL: Recent SEO Reports (Oct 2026!)
# ==========================================
print("📂 Inlezen HVL: Recente SEO Command Reports...")
SEO_DIR = os.path.join(HOME, r"Documents\SecondBrainVault\_cowork\artefacts\seo")
if os.path.exists(SEO_DIR):
    for f in os.listdir(SEO_DIR):
        fp = os.path.join(SEO_DIR, f)
        if os.path.isfile(fp):
            ext = os.path.splitext(f)[1].lower().replace('.', '')
            ftype = "pdf" if ext == "pdf" else ("html" if ext == "html" else "other")
            sz = os.path.getsize(fp)
            mtime = os.path.getmtime(fp)
            date_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
            all_versions.append({
                "id": f"hvl-seo-{len(all_versions)}",
                "file_name": f,
                "title": os.path.splitext(f)[0],
                "base_title": extract_base_title(f),
                "channel": "hansvanleeuwen",
                "category": "SEO & SERP Intelligence",
                "file_type": ftype,
                "file_size_bytes": sz,
                "size_formatted": format_size(sz),
                "quality": "SEO Audit 2026",
                "version_label": detect_version_label(f),
                "created_at": date_str,
                "local_path": sanitize_local_path(fp),
                "tags": ["seo", "visibility", "command-report", "october-2026"]
            })

# ==========================================
# 3. HARVEST CCP: Connectcarparts Strategy & Bol.com / eBay
# ==========================================
print("📂 Inlezen CCP: Supabase & Lokale Strategie en Bol/eBay Bestanden...")
# From Supabase document_archive (CCP rows)
db_docs = req_supabase("document_archive?select=*&domain=eq.ccp")
for d in db_docs:
    fn = d.get("filename") or d.get("title")
    sz = d.get("file_size_bytes") or 0
    all_versions.append({
        "id": d.get("id"),
        "file_name": fn,
        "title": d.get("title") or fn,
        "base_title": extract_base_title(d.get("title") or fn),
        "channel": "connectcarparts",
        "category": d.get("category") or "Strategie & Expansie",
        "file_type": d.get("file_type") or "pdf",
        "file_size_bytes": sz,
        "size_formatted": format_size(sz),
        "quality": "Strategisch Rapport",
        "version_label": detect_version_label(fn),
        "created_at": d.get("source_date") or d.get("uploaded_at")[:10] if d.get("uploaded_at") else "2026-05-22",
        "local_path": None,
        "description": d.get("description"),
        "tags": d.get("tags") or ["ccp", "marketplace"]
    })

# Local CCP Bol.com templates from Oct 2026
CCP_BOL_DIR = os.path.join(HOME, r"Documents\SecondBrainVault\_cowork\ccp-bol-nl\bol-templates\2026-10-06")
if os.path.exists(CCP_BOL_DIR):
    for f in os.listdir(CCP_BOL_DIR):
        fp = os.path.join(CCP_BOL_DIR, f)
        if os.path.isfile(fp):
            sz = os.path.getsize(fp)
            all_versions.append({
                "id": f"ccp-bol-{len(all_versions)}",
                "file_name": f,
                "title": os.path.splitext(f)[0],
                "base_title": extract_base_title(f),
                "channel": "connectcarparts",
                "category": "Bol.com & Categorie Regels",
                "file_type": "sheet" if f.endswith(".csv") else "doc",
                "file_size_bytes": sz,
                "size_formatted": format_size(sz),
                "quality": "Live Template (Okt 2026)",
                "version_label": "v1 (2026-10-06)",
                "created_at": "2026-10-06",
                "local_path": sanitize_local_path(fp),
                "tags": ["bol-com", "templates", "remsystemen", "channable"]
            })

# ==========================================
# 4. HARVEST NEON: LP Masters (Oct 3, 2026)
# ==========================================
print("📂 Inlezen NeoN: 15 LP Masters (3 okt 2026)...")
LP_MASTERS_DIR = os.path.join(HOME, r"Music\NEON Album\NEON The Signal Between - Masters")
if os.path.exists(LP_MASTERS_DIR):
    for f in os.listdir(LP_MASTERS_DIR):
        if f.lower().endswith(".wav"):
            fp = os.path.join(LP_MASTERS_DIR, f)
            sz = os.path.getsize(fp)
            song = detect_song(f) or extract_base_title(f)
            all_versions.append({
                "id": f"neon-lp-{len(all_versions)}",
                "file_name": f,
                "title": os.path.splitext(f)[0],
                "base_title": song,
                "song": song,
                "channel": "neon",
                "category": "NEON The Signal Between (Masters)",
                "file_type": "audio",
                "file_size_bytes": sz,
                "size_formatted": format_size(sz),
                "quality": "LP Master (Comb-Flattener 96k/24b)",
                "version_label": "LP Master (96k 24-bit)",
                "created_at": "2026-10-03",
                "local_path": sanitize_local_path(fp),
                "tags": ["lp-master", "96k-24bit", "comb-flattener", "album"]
            })

# ==========================================
# 5. HARVEST NEON: Neural Analog & Masters in Downloads\Muziek (Oct 1, 2026)
# ==========================================
print("📂 Inlezen NeoN: Neural Analog Masters in Downloads\\Muziek...")
MUZIEK_DIR = os.path.join(HOME, r"Downloads\Muziek")
if os.path.exists(MUZIEK_DIR):
    for f in os.listdir(MUZIEK_DIR):
        fp = os.path.join(MUZIEK_DIR, f)
        if os.path.isfile(fp) and any(f.lower().endswith(e) for e in [".wav", ".flac", ".mp3", ".m4a"]):
            sz = os.path.getsize(fp)
            song = detect_song(f) or extract_base_title(f)
            qual = detect_quality(f)
            v_lbl = detect_version_label(f)
            mtime = os.path.getmtime(fp)
            date_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d")
            all_versions.append({
                "id": f"neon-dl-{len(all_versions)}",
                "file_name": f,
                "title": os.path.splitext(f)[0],
                "base_title": song,
                "song": song,
                "channel": "neon",
                "category": "Neural Analog Masters",
                "file_type": "audio",
                "file_size_bytes": sz,
                "size_formatted": format_size(sz),
                "quality": qual,
                "version_label": v_lbl,
                "created_at": date_str,
                "local_path": sanitize_local_path(fp),
                "tags": ["neuralanalog", "master", "audio"]
            })

# ==========================================
# 6. HARVEST NEON: Supabase music_tracks (295 tracks)
# ==========================================
print("📂 Inlezen NeoN: Supabase music_tracks...")
db_tracks = req_supabase("music_tracks?select=id,song_title,file_name,variant_label,track_kind,status,format,duration_seconds,file_size_bytes,bpm,musical_key,external_url,suno_url,soundcloud_url,spotify_url,neuralanalog_url,created_at,updated_at&limit=500")
print(f"Supabase tracks loaded: {len(db_tracks)}")
for t in db_tracks:
    fn = t.get("file_name") or f"{t.get('song_title')}.wav"
    sz = t.get("file_size_bytes") or 0
    song = t.get("song_title") or detect_song(fn) or extract_base_title(fn)
    qual = detect_quality(fn, t.get("track_kind") or "")
    if (t.get("neuralanalog_url") or sz > 100 * 1024 * 1024) and "NeuralAnalog" not in qual and "LP Master" not in qual:
        qual = "NeuralAnalog Master (Hi-Res WAV)"
    all_versions.append({
        "id": t.get("id"),
        "file_name": fn,
        "title": t.get("variant_label") or fn,
        "base_title": song,
        "song": song,
        "channel": "neon",
        "category": f"Track: {t.get('track_kind') or 'Master'}",
        "file_type": "audio",
        "file_size_bytes": sz,
        "size_formatted": format_size(sz),
        "quality": qual,
        "version_label": t.get("variant_label") or detect_version_label(fn),
        "created_at": t.get("created_at")[:10] if t.get("created_at") else "2026-08-09",
        "external_url": t.get("external_url"),
        "stream_url": t.get("external_url"),
        "neuralanalog_url": t.get("neuralanalog_url"),
        "suno_url": t.get("suno_url"),
        "soundcloud_url": t.get("soundcloud_url"),
        "spotify_url": t.get("spotify_url"),
        "bpm": t.get("bpm"),
        "musical_key": t.get("musical_key"),
        "duration_seconds": t.get("duration_seconds"),
        "tags": ["track", t.get("track_kind") or "audio"]
    })

# ==========================================
# 7. HARVEST NEON: Beeldbank (1,426 artwork/video assets)
# ==========================================
print("📂 Inlezen NeoN: Beeldbank assets...")
BEELDBANK_DIR = os.path.join(HOME, r"Music\NEON Album\Beeldbank")
BEELDBANK_CSV = os.path.join(BEELDBANK_DIR, "_manifest.csv")
if os.path.exists(BEELDBANK_CSV):
    with open(BEELDBANK_CSV, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        b_count = 0
        for r in reader:
            b_count += 1
            fn = r.get("bestand") or r.get("id")
            song = r.get("song") or r.get("album") or "NEON"
            mtype = r.get("type") or "image"
            ftype = "video" if mtype == "video" else "image"
            sz = int(r.get("bytes") or 0)
            is_actueel = r.get("actueel") in [True, "True", "true", "1"]
            date_str = r.get("bijgewerkt")[:10] if r.get("bijgewerkt") else "2026-09-30"
            all_versions.append({
                "id": f"beeldbank-{r.get('id')}",
                "file_name": fn,
                "title": r.get("titel") or fn,
                "base_title": f"{song} - Artwork / Media" if song else extract_base_title(r.get("titel") or fn),
                "song": song if song != "NEON" else None,
                "channel": "neon",
                "category": f"Beeldbank ({r.get('categorieen') or 'Artwork'})",
                "file_type": ftype,
                "file_size_bytes": sz,
                "size_formatted": format_size(sz),
                "quality": "HD Media" if sz > 1024*1024 else "Web Asset",
                "version_label": "Actueel" if is_actueel else "Revisie",
                "created_at": date_str,
                "local_path": sanitize_local_path(os.path.join(BEELDBANK_DIR, r.get("map") or "Alle afbeeldingen", fn)),
                "tags": ["beeldbank", mtype]
            })
    print(f"Beeldbank assets harvested: {b_count}")

print(f"\n✅ Total raw versions harvested across all channels: {len(all_versions)}")

# ==========================================
# 8. DEDUPLICATION & VERSION GROUPING (Beeldbank Style)
# ==========================================
print("\n🔄 Dedupliceren en Versiehistorie opbouwen...")

groups_dict = {}

for item in all_versions:
    ch = item["channel"]
    base = item["base_title"]
    ft = item["file_type"]
    
    # Key for grouping: Channel + File Type (audio vs doc vs image/video) + Base Title
    # For audio: group by song
    if ch == "neon" and item.get("song"):
        group_key = f"neon-song-{item['song'].lower().strip()}-{ft}"
    else:
        clean_base = re.sub(r'[^a-zA-Z0-9]', '', base.lower())
        group_key = f"{ch}-{ft}-{clean_base}"
    
    if group_key not in groups_dict:
        # Canonical display title
        canonical_title = item.get("song") or base
        groups_dict[group_key] = {
            "id": group_key,
            "title": canonical_title,
            "channel": ch,
            "file_type": ft,
            "category": item["category"],
            "song": item.get("song"),
            "master_quality": item.get("quality"),
            "tags": list(set(item.get("tags") or [])),
            "versions": []
        }
    
    groups_dict[group_key]["versions"].append(item)
    # Merge tags
    for t in item.get("tags") or []:
        if t not in groups_dict[group_key]["tags"]:
            groups_dict[group_key]["tags"].append(t)

# Build sorted final catalog
catalog = []
quality_priority = {
    "LP Master (Comb-Flattener 96k/24b)": 10,
    "NeuralAnalog (-12 LUFS)": 9,
    "NeuralAnalog (-14 LUFS)": 9,
    "NeuralAnalog (-8 LUFS)": 9,
    "NeuralAnalog (-9.5 LUFS)": 9,
    "NeuralAnalog Master (Hi-Res WAV)": 9,
    "NeuralAnalog (Studio AI)": 8,
    "Clean Master (Hi-Res)": 7,
    "Mixea Master": 6,
    "Mastered": 5,
    "Dolby Atmos": 5,
    "Stem Mix / Instrumental": 4,
    "Mix / Arrangement": 3,
    "Live Template (Okt 2026)": 9,
    "SEO Audit 2026": 9,
    "Strategisch Rapport": 8,
    "Document PDF": 5,
}

for g_key, g in groups_dict.items():
    # Sort versions by date desc, then quality priority desc
    def version_score(v):
        dt = v.get("created_at") or "1970-01-01"
        qp = quality_priority.get(v.get("quality") or "", 1)
        sz = v.get("file_size_bytes") or 0
        return (dt, qp, sz)
    
    sorted_versions = sorted(g["versions"], key=version_score, reverse=True)
    latest = sorted_versions[0]
    
    # Mark is_latest flag
    for idx, v in enumerate(sorted_versions):
        v["is_latest"] = (idx == 0)
    
    # Music CMS link
    cms_url = None
    if g["channel"] == "neon":
        if g.get("song"):
            cms_url = f"/music-cms?mode=productie&song={urllib.parse.quote(g['song'])}"
        else:
            cms_url = "/music-cms?mode=productie"
            
    catalog.append({
        "id": g["id"],
        "title": g["title"],
        "channel": g["channel"],
        "file_type": g["file_type"],
        "category": g["category"],
        "song": g.get("song"),
        "master_quality": latest.get("quality"),
        "tags": g["tags"][:8],
        "created_at": latest.get("created_at") or "2026-10-01",
        "updated_at": latest.get("created_at") or "2026-10-01",
        "version_count": len(sorted_versions),
        "latest_version": latest,
        "versions": sorted_versions,
        "music_cms_url": cms_url
    })

# Sort catalog so newest items are on top
catalog.sort(key=lambda x: x["updated_at"], reverse=True)

print(f"\n🎉 Unified Catalog created with {len(catalog)} unique attachment groups (from {len(all_versions)} total versions)!")
for ch in ["connectcarparts", "hansvanleeuwen", "neon"]:
    c_count = len([c for c in catalog if c["channel"] == ch])
    v_count = sum(len(c["versions"]) for c in catalog if c["channel"] == ch)
    print(f"  ↳ {ch}: {c_count} unieke items ({v_count} versies)")

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"\n💾 Saved catalog to: {OUTPUT_FILE}")
