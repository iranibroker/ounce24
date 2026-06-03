const fs = require('fs');
const path = require('path');

const filePath = '/Users/mahdi.ketabdar/Developer/ounce24/node_modules/@ng-icons/iconsax/fesm2022/ng-icons-iconsax-outline.mjs';
const fileContent = fs.readFileSync(filePath, 'utf8');

const regex = /const\s+(sax[A-Za-z0-9]+Outline)\s*=/g;
let match;
const matches = [];

while ((match = regex.exec(fileContent)) !== null) {
  matches.push(match[1]);
}

console.log('Total outline icons:', matches.length);
console.log('Matching "download":', matches.filter(name => name.toLowerCase().includes('download')));
console.log('Matching "down":', matches.filter(name => name.toLowerCase().includes('down')));
console.log('Matching "import":', matches.filter(name => name.toLowerCase().includes('import')));
console.log('Matching "receive":', matches.filter(name => name.toLowerCase().includes('receive')));
console.log('Matching "info":', matches.filter(name => name.toLowerCase().includes('info')));
console.log('Matching "install":', matches.filter(name => name.toLowerCase().includes('install')));
console.log('Matching "add":', matches.filter(name => name.toLowerCase().includes('add')));
console.log('Matching "home":', matches.filter(name => name.toLowerCase().includes('home')));
console.log('Some icons:', matches.slice(0, 50));
