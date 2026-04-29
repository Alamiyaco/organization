
const SHEET_NAME = 'Sheet1';
const PHOTO_FOLDER_ID = '';

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  const photoMap = getPhotoMap_();

  const employees = values
    .filter(row => row.some(v => v !== ''))
    .map(row => {
      const item = {};
      headers.forEach((h, i) => item[h] = row[i] == null ? '' : String(row[i]).trim());
      const name = item['Employee Name'] || item['name'] || '';
      return {
        name,
        branch: item['Branch'] || '',
        department: item['Department'] || '',
        position: item['position'] || item['Position'] || '',
        manager: item['Manager'] || '',
        photoUrl: item['Photo'] || photoMap[normalize_(name)] || ''
      };
    })
    .filter(e => e.name);

  return ContentService
    .createTextOutput(JSON.stringify({ employees, generatedAt: new Date().toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getPhotoMap_() {
  const map = {};
  if (!PHOTO_FOLDER_ID) return map;

  const folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName().replace(/\.[^/.]+$/, '');
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    map[normalize_(name)] = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  }

  return map;
}

function normalize_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}
