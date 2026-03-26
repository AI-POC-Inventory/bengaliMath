import fitz  # PyMuPDF
from PyPDF2 import PdfReader, PdfWriter
import io
import pytesseract
from PIL import Image

pytesseract.pytesseract.tesseract_cmd = r"D:\Sujit\ocr\tesseract.exe"

def extract_pages(pdf_path):
    doc = fitz.open(pdf_path)
    pages = []

    for i, page in enumerate(doc):
        if(i>15):
            break
        text = page.get_text()

        # 🔥 If no text → use OCR
        if not text.strip():
            pix = page.get_pixmap()
            img_data = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_data))

            #text = pytesseract.image_to_string(image, lang="ben+eng")
            text = pytesseract.image_to_string(
                    image,
                    lang="ben",
                    config="--oem 3 --psm 6"
                )

        pages.append({
            "page_num": i + 1,
            "text": text
        })

        print(f"Page {i+1} text length: {len(text)}")

    return pages
import re

def detect_headings(pages):
    headings = []

    pattern = r"(Chapter\s+\d+|অধ্যায়\s+\d+|CHAPTER\s+\d+)"

    for page in pages:
        print(f"Detecting headings in page {page['page_num']} with text length {len(page['text'])}")
        headings.append({
                "title": "Chapter " + re.search(r"\d+", page["text"]).group() if re.search(r"\d+", page["text"]) else "Chapter",
                "page": page["page_num"]
            })
    return headings

def get_ranges(headings, total_pages):
    ranges = []

    for i in range(len(headings)):
        start = headings[i]["page"]
        end = headings[i+1]["page"] - 1 if i+1 < len(headings) else total_pages

        ranges.append({
            "title": headings[i]["title"],
            "start": start,
            "end": end
        })

    return ranges


def split_pdf(pdf_path, ranges):
    doc = fitz.open(pdf_path)

    for r in ranges:
        new_doc = fitz.open()

        for i in range(r["start"]-1, r["end"]):
            new_doc.insert_pdf(doc, from_page=i, to_page=i)

        filename = f"{r['title'].replace(' ', '_')}.pdf"
        new_doc.save(filename)
        
if __name__ == "__main__":
    pdf_path = "./class_VII.pdf"
    pages = extract_pages(pdf_path)
    headings = detect_headings(pages)
    print(headings)
    ranges = get_ranges(headings, len(pages))
    split_pdf(pdf_path, ranges)