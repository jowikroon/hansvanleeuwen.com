import sys
import json
import os
sys.path.append(os.path.join(os.path.expanduser("~"), r"Documents\SecondBrainVault"))
from export_all_google_docs_to_pdf import GoogleDriveClient, TOKEN_FILE, DRIVE_API_BASE

c = GoogleDriveClient(TOKEN_FILE)
query = "mimeType = 'application/vnd.google-apps.document' and trashed = false"
params = [
    f"q={urllib.parse.quote(query)}",
    "pageSize=100",
    "fields=nextPageToken,files(id,name,parents,modifiedTime,createdTime)",
    "supportsAllDrives=true",
    "includeItemsFromAllDrives=true"
]
url = f"{DRIVE_API_BASE}/files?{'&'.join(params)}"
raw = c.request(url)
data = json.loads(raw.decode('utf-8'))
files = data.get("files", [])
print(f"Found: {len(files)}")
mod_dates = [f.get("modifiedTime") for f in files if f.get("modifiedTime")]
print(f"Max modifiedTime in batch: {max(mod_dates) if mod_dates else 'none'}")
print(f"Min modifiedTime in batch: {min(mod_dates) if mod_dates else 'none'}")
for f in files[:10]:
    print(f.get("modifiedTime"), "|", f.get("name"))
