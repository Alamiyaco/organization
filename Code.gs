function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift().map(h => String(h).trim());
  const photoMap = getPhotoMap_();
  const employees = values
    .filter(r => r.some(Boolean))
    .map(r => {
      const obj = {};
      headers.forEach((h,i) => obj[h] = r[i]);
      const name = clean_(obj['Employee Name'] || obj['name']);
      return {
        name,
        branch: clean_(obj['Branch'] || obj['branch']),
        department: clean_(obj['Department'] || obj['department'] || obj['dept']),
        position: clean_(obj['position'] || obj['Position']),
        manager: clean_(obj['Manager'] || obj['manager']),
        photoUrl: clean_(obj['Photo'] || obj['Image'] || obj['photoUrl']) || photoMap[name] || ''
      };
    })
    .filter(e => e.name);

  return ContentService
    .createTextOutput(JSON.stringify({ generatedAt: new Date().toISOString(), employees }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getPhotoMap_(){
  const folderId = PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID');
  if(!folderId) return {};
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const map = {};
  while(files.hasNext()){
    const f = files.next();
    const base = f.getName().replace(/\.[^.]+$/, '').trim();
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    map[base] = 'https://drive.google.com/uc?export=view&id=' + f.getId();
  }
  return map;
}
function clean_(v){ return String(v || '').trim().replace(/\s+/g,' '); }
