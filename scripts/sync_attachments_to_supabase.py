import os
import sys
import json
import re
import urllib.request
import urllib.parse
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

# Remove proxies
for k in list(os.environ.keys()):
    if 'proxy' in k.lower():
        del os.environ[k]

HOME = os.path.expanduser("~")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.join(HOME, r"Downloads\GoogleDrive_DeepResearch_PDFs")
REGISTRY_FILE = os.path.join(BASE_DIR, "download_registry.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "attachmentsManifest.json")

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

SUPABASE_URL = "https://pesfakewujjwkyybwaom.supabase.co/rest/v1"
SERVICE_KEY = get_service_key()

# Load registry
with open(REGISTRY_FILE, "r", encoding="utf-8") as f:
    registry = json.load(f)

print(f"Loaded {len(registry)} items from download_registry.json")

# Walk directory to find all PDF files
pdf_items = []
for root, dirs, files in os.walk(BASE_DIR):
    for f in files:
        if f.lower().endswith(".pdf"):
            full_path = os.path.join(root, f)
            rel_dir = os.path.relpath(root, BASE_DIR)
            category = "Hoofdmap" if rel_dir == "." else rel_dir
            size_bytes = os.path.getsize(full_path)
            
            # Find doc_id from registry if present
            doc_id = None
            for gid, p in registry.items():
                if os.path.normpath(p) == os.path.normpath(full_path):
                    doc_id = gid
                    break

            # Derive tags
            name_clean = os.path.splitext(f)[0]
            tags = [t.lower() for t in re.findall(r'[a-zA-Z0-9_-]+', name_clean) if len(t) > 3][:6]
            if "research" in category.lower() or "onderzoek" in category.lower():
                tags.append("deep-research")

            # Map category for DB
            db_cat = "research"
            if any(k in category.lower() for k in ["operatie", "bco", "ggd", "richtlijn"]):
                db_cat = "operations"
            elif any(k in category.lower() for k in ["strategie", "plan", "business"]):
                db_cat = "strategy"

            pdf_items.append({
                "id": doc_id or f"local-{len(pdf_items)}",
                "filename": f,
                "title": name_clean,
                "category": category,
                "db_category": db_cat,
                "file_type": "pdf",
                "file_size_bytes": size_bytes,
                "size_formatted": f"{size_bytes / 1024:.1f} KB" if size_bytes < 1024*1024 else f"{size_bytes / (1024*1024):.2f} MB",
                "local_path": full_path,
                "google_doc_id": doc_id,
                "google_preview_url": f"https://docs.google.com/document/d/{doc_id}/preview" if doc_id else None,
                "google_edit_url": f"https://docs.google.com/document/d/{doc_id}/edit" if doc_id else None,
                "drive_file_url": f"https://drive.google.com/file/d/{doc_id}/preview" if doc_id else None,
                "tags": tags,
                "domain": "hansvanleeuwen"
            })

print(f"Total collected PDF items: {len(pdf_items)}")

# Ensure src/data dir exists
os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(pdf_items, f, indent=2, ensure_ascii=False)

print(f"✅ Saved frontend manifest to: {OUTPUT_JSON}")

# Batch sync to Supabase document_archive
print("\n🔄 Syncing to Supabase document_archive in batches...")
batch_size = 50
inserted_total = 0

# Check existing filenames to avoid duplicates
existing_filenames = set()
try:
    check_url = f"{SUPABASE_URL}/document_archive?select=filename&domain=eq.hansvanleeuwen&limit=1000"
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    req = urllib.request.Request(check_url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        existing = json.loads(resp.read().decode('utf-8'))
        existing_filenames = set(d.get("filename") for d in existing)
        print(f"Found {len(existing_filenames)} existing documents in Supabase.")
except Exception as e:
    print("Warning checking existing:", e)

new_records = []
seen_filenames = set(existing_filenames)

for item in pdf_items:
    base_fn = item["filename"]
    fn = base_fn
    counter = 1
    while fn in seen_filenames:
        name_part, ext = os.path.splitext(base_fn)
        fn = f"{name_part} ({counter}){ext}"
        counter += 1
    seen_filenames.add(fn)
    
    if fn in existing_filenames:
        continue
    
    new_records.append({
        "filename": fn,
        "title": item["title"],
        "domain": "hansvanleeuwen",
        "category": item["db_category"],
        "file_type": "pdf",
        "file_size_bytes": item["file_size_bytes"],
        "tags": item["tags"],
        "description": f"Google Drive export: [{item['category']}] | Google Doc ID: {item.get('google_doc_id') or 'N/A'}",
        "kb_slug": item.get("google_doc_id") or item["title"][:50],
        "status": "active"
    })

print(f"New records to insert into Supabase: {len(new_records)}")

for i in range(0, len(new_records), batch_size):
    chunk = new_records[i:i + batch_size]
    post_url = f"{SUPABASE_URL}/document_archive?on_conflict=filename"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
    }
    req = urllib.request.Request(post_url, data=json.dumps(chunk).encode('utf-8'), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            inserted_total += len(chunk)
            print(f"   ↳ Ingested batch {i // batch_size + 1}: {len(chunk)} items (Total: {inserted_total}/{len(new_records)})")
    except urllib.error.HTTPError as e:
        print(f"❌ Error inserting batch: {e.code} - {e.read().decode('utf-8')}")
        break

print(f"\n🎉 Sync complete! Total inserted into Supabase: {inserted_total}")
