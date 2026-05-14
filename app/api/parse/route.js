import { NextResponse } from 'next/server';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

async function extractText(file) {
  const fileName = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = fileName.split('.').pop();

  // PDF
  if (ext === 'pdf') {
    const { extractText } = await import('unpdf');
    const uint8 = new Uint8Array(arrayBuffer);
    const result = await extractText(uint8, { mergePages: true });
    return String(result.text || '');
  }

  // Plain text, markdown, CSV — just read as string
  if (['txt', 'md', 'csv'].includes(ext)) {
    return buffer.toString('utf-8');
  }

  // Word documents (.docx)
  if (ext === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return String(result.value || '');
  }

  // Excel (.xlsx, .xls)
  if (['xlsx', 'xls'].includes(ext)) {
    const XLSX = require('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const text = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      return `Sheet: ${name}\n` + XLSX.utils.sheet_to_csv(sheet);
    }).join('\n\n');
    return String(text || '');
  }

  // PowerPoint (.pptx, .ppt)
  if (['pptx', 'ppt'].includes(ext)) {
    const officeparser = require('officeparser');
    const text = await new Promise((resolve, reject) => {
      officeparser.parseOffice(buffer, (data, err) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    return String(text || '');
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided.' },
        { status: 400 }
      );
    }

    const text = await extractText(file);

    if (!text || text.trim().length < 30) {
      return NextResponse.json(
        { error: 'Could not extract text from this file. It may be empty or image-based.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: text,
      pages: 1,
      fileName: file.name,
    });

  } catch (error) {
    console.error('Parse error:', error.message);
    return NextResponse.json(
      { error: 'Failed to parse file: ' + error.message },
      { status: 500 }
    );
  }
}