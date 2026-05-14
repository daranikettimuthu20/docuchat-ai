import { NextResponse } from 'next/server';
import { extractText } from 'unpdf';

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

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { text } = await extractText(buffer, { mergePages: true });

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract text. The PDF may be scanned or image-based.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: text,
      pages: 1,
      fileName: file.name,
    });

  } catch (error) {
    console.error('PDF parse error:', error);
    return NextResponse.json(
      { error: 'Failed to parse PDF: ' + error.message },
      { status: 500 }
    );
  }
}