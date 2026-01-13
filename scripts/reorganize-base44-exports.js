/**
 * Base44 Export File Reorganization Script
 * 
 * This script reorganizes all Base44 exported files:
 * - Renames .docx files to proper extensions (.json, .ts, .md, etc.)
 * - Moves files into appropriate folders
 * - Creates proper folder structure
 * 
 * Usage: node scripts/reorganize-base44-exports.js
 */

const fs = require('fs').promises;
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'base44-export');

// File categorization rules
const FILE_RULES = [
  // Schema files (JSON)
  { pattern: /\.schema\.json\.docx$/, newExt: '.schema.json', folder: 'schemas' },
  
  // Page files
  { pattern: /Page.*\.(txt|docx)$/, newExt: '.tsx', folder: 'pages' },
  { pattern: /(Admin|User).*Page.*\.(txt|docx)$/, newExt: '.tsx', folder: 'pages' },
  
  // Component files
  { pattern: /Component.*\.(txt|docx)$/, newExt: '.tsx', folder: 'components' },
  
  // Function/API files
  { pattern: /(function|api|endpoint).*\.(txt|docx)$/i, newExt: '.ts', folder: 'functions' },
  
  // Secret/config files
  { pattern: /(secret|key|token|api.*url).*\.(txt|docx)$/i, newExt: '.md', folder: 'secrets' },
  
  // Documentation files
  { pattern: /(spec|doc|report|bug.*report).*\.(txt|docx)$/i, newExt: '.md', folder: 'docs' },
  
  // Test files
  { pattern: /\.test\.(txt|docx)$/, newExt: '.test.ts', folder: 'tests' },
  
  // Text/Markdown files
  { pattern: /\.(txt|TXT)$/, newExt: '.md', folder: 'docs' },
  
  // Already correct JSON
  { pattern: /\.json$/, newExt: '.json', folder: 'schemas' },
];

async function main() {
  console.log('🚀 Starting Base44 export reorganization...\n');
  
  try {
    // Read all files in base44-export
    const files = await fs.readdir(BASE_DIR);
    console.log(`📁 Found ${files.length} files/folders\n`);
    
    // Create folder structure
    const folders = ['schemas', 'pages', 'components', 'functions', 'secrets', 'docs', 'tests', 'entities'];
    for (const folder of folders) {
      const folderPath = path.join(BASE_DIR, folder);
      try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`✅ Created folder: ${folder}`);
      } catch (err) {
        if (err.code !== 'EEXIST') throw err;
      }
    }
    
    console.log('\n📝 Processing files...\n');
    
    // Process each file
    let processedCount = 0;
    for (const file of files) {
      const filePath = path.join(BASE_DIR, file);
      const stat = await fs.stat(filePath);
      
      // Skip directories
      if (stat.isDirectory()) continue;
      
      // Find matching rule
      let matched = false;
      for (const rule of FILE_RULES) {
        if (rule.pattern.test(file)) {
          const newName = file.replace(/\.(txt|docx|TXT)$/, '').replace(/\.schema\.json\.docx$/, '.schema.json') + (rule.newExt.startsWith('.') ? '' : '.') + rule.newExt.replace(/^\./, '');
          const newPath = path.join(BASE_DIR, rule.folder, newName);
          
          try {
            await fs.rename(filePath, newPath);
            console.log(`  ✓ ${file} → ${rule.folder}/${newName}`);
            processedCount++;
            matched = true;
            break;
          } catch (err) {
            console.error(`  ✗ Error moving ${file}:`, err.message);
          }
        }
      }
      
      if (!matched) {
        console.log(`  ⚠️  No rule matched: ${file}`);
      }
    }
    
    console.log(`\n✨ Reorganization complete! Processed ${processedCount} files.`);
    console.log('\n📊 Summary:');
    
    // Show summary
    for (const folder of folders) {
      const folderPath = path.join(BASE_DIR, folder);
      try {
        const folderFiles = await fs.readdir(folderPath);
        console.log(`  ${folder}: ${folderFiles.length} files`);
      } catch (err) {
        console.log(`  ${folder}: 0 files`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
