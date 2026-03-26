import json
import base64
import os
from pathlib import Path
from abc import ABC, abstractmethod
from dotenv import load_dotenv

# PDF handling
import fitz  # PyMuPDF


load_dotenv()

# ============================================================
# Base Class for GenAI Extractors
# ============================================================

class BaseGenAIExtractor(ABC):
    """Base class for GenAI-based PDF extraction"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.model_name = None
    
    @abstractmethod
    def extract_from_pdf(self, pdf_path: str) -> dict:
        """Extract questions and answers from PDF"""
        pass
    
    def _get_extraction_prompt(self) -> str:
        """Common prompt for extraction"""
        return """
You are an expert at extracting educational content from textbooks.

Analyze this PDF page from a Bengali mathematics textbook. No need to calculate where solution is not given. Convert to english fully with proper grammar and extract ALL content in the following JSON format:

{
    "chapter": {
        "number": <chapter number as integer>,
        "title": "<chapter title if visible>",
        "book": "<book name>",
        "class": "<class/grade level>"
    },
    "example": {
        "problem": "<example problem text in Bengali>",
        "problem_english": "<English translation>",
        "solution": {
            "given": "<given information>",
            "steps": ["<step 1>", "<step 2>", ...],
            "calculation": "<main calculation>",
            "answer": "<final answer>"
        }
    },
    "exercises": {
        "section": "<section name like 'করে দেখি — 1.1'>",
        "questions": [
            {
                "number": <question number>,
                "question": "<full question text in Bengali>",
                "question_english": "<English translation>",
                "type": "<question type: fraction/decimal/word_problem/etc>",
                "solution": {
                    "steps": ["<step 1>", "<step 2>", ...],
                    "calculation": "<calculation details>",
                    "formula_used": "<any formula used>"
                },
                "answer": "<final answer with units>"
            }
        ]
    }
}

IMPORTANT:
1. Output MUST be strictly valid JSON
2. Do NOT include trailing commas
3. All keys and strings MUST use double quotes
4. Do NOT truncate arrays or objects
5. Ensure all brackets are properly closed
6. If unsure, return empty arrays instead of partial data
7. DO NOT wrap response in ```json or markdown
8. Response must be directly parseable by json.loads()
"""
    
    def _pdf_to_images(self, pdf_path: str, dpi: int = 200) -> list:
        """Convert PDF pages to base64 images"""
        doc = fitz.open(pdf_path)
        images = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            # Higher DPI for better text recognition
            mat = fitz.Matrix(dpi/72, dpi/72)
            pix = page.get_pixmap(matrix=mat)
            img_bytes = pix.tobytes("png")
            img_base64 = base64.b64encode(img_bytes).decode('utf-8')
            images.append({
                "page": page_num + 1,
                "base64": img_base64,
                "mime_type": "image/png"
            })
        
        doc.close()
        return images
    
    def _pdf_to_text(self, pdf_path: str) -> str:
        """Extract text from PDF"""
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    
    def save_to_json(self, data: dict, output_path: str = None) -> str:
        """Save extracted data to JSON file"""
        if output_path is None:
            output_path = "extracted_content.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ Data saved to {output_path}")
        return output_path


# ============================================================
# OpenAI GPT-4 Vision Implementation
# ============================================================

class OpenAIExtractor(BaseGenAIExtractor):
    """Extract using OpenAI GPT-4 Vision"""
    
    def __init__(self, api_key: str = None):
        super().__init__(api_key or os.getenv("OPENAI_API_KEY"))
        self.model_name = "gpt-4o"  # or "gpt-4-vision-preview"
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        from openai import OpenAI
        
        client = OpenAI(api_key=self.api_key)
        images = self._pdf_to_images(pdf_path)
        
        # Prepare image content for API
        image_content = []
        for img in images:
            image_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['mime_type']};base64,{img['base64']}",
                    "detail": "high"
                }
            })
        
        response = client.chat.completions.create(
            model=self.model_name,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at extracting educational content from textbooks. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self._get_extraction_prompt()},
                        *image_content
                    ]
                }
            ],
            max_tokens=4096,
            temperature=0.1
        )
        
        # Parse response
        result_text = response.choices[0].message.content
        
        # Clean and parse JSON
        result_text = result_text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# Google Gemini Implementation
# ============================================================

class GeminiExtractor(BaseGenAIExtractor):
    """Extract using Google Gemini"""
    
    def __init__(self, api_key: str = None):
        super().__init__(api_key or os.getenv("GOOGLE_API_KEY"))
        ##self.model_name = "gemini-1.5-pro"
        self.model_name = "gemini-2.5-flash"
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        import google.generativeai as genai
        from PIL import Image
        import io
        
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)
        
        # Convert PDF to images
        images = self._pdf_to_images(pdf_path)
        
        # Prepare PIL images for Gemini
        pil_images = []
        for img in images:
            img_bytes = base64.b64decode(img['base64'])
            pil_image = Image.open(io.BytesIO(img_bytes))
            pil_images.append(pil_image)
        
        # Create content with images
        content = [self._get_extraction_prompt()] + pil_images
        
        response = model.generate_content(
            content,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=4096
            )
        )
        
        # Parse response
        result_text = response.text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        print("Extracted JSON string:", result_text)
        return json.loads(result_text)
    
    def extract_from_pdf_direct(self, pdf_path: str) -> dict:
        """
        Direct PDF upload (Gemini 1.5+ supports native PDF)
        """
        import google.generativeai as genai
        
        genai.configure(api_key=self.api_key)
        model = genai.GenerativeModel(self.model_name)
        
        # Upload PDF directly
        pdf_file = genai.upload_file(pdf_path)
        
        response = model.generate_content(
            [self._get_extraction_prompt(), pdf_file],
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,
                max_output_tokens=4096
            )
        )
        
        result_text = response.text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# Anthropic Claude Implementation
# ============================================================

class ClaudeExtractor(BaseGenAIExtractor):
    """Extract using Anthropic Claude"""
    
    def __init__(self, api_key: str = None):
        super().__init__(api_key or os.getenv("ANTHROPIC_API_KEY"))
        self.model_name = "claude-sonnet-4-20250514"
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        import anthropic
        
        client = anthropic.Anthropic(api_key=self.api_key)
        images = self._pdf_to_images(pdf_path)
        
        # Prepare image content for Claude
        image_content = []
        for img in images:
            image_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img['mime_type'],
                    "data": img['base64']
                }
            })
        
        # Add text prompt
        image_content.append({
            "type": "text",
            "text": self._get_extraction_prompt()
        })
        
        response = client.messages.create(
            model=self.model_name,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": image_content
                }
            ]
        )
        
        # Parse response
        result_text = response.content[0].text.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# Azure OpenAI Implementation
# ============================================================

class AzureOpenAIExtractor(BaseGenAIExtractor):
    """Extract using Azure OpenAI"""
    
    def __init__(self, api_key: str = None, endpoint: str = None, deployment: str = None):
        super().__init__(api_key or os.getenv("AZURE_OPENAI_API_KEY"))
        self.endpoint = endpoint or os.getenv("AZURE_OPENAI_ENDPOINT")
        self.deployment = deployment or os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
        self.model_name = f"azure/{self.deployment}"
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        from openai import AzureOpenAI
        
        client = AzureOpenAI(
            api_key=self.api_key,
            api_version="2024-02-15-preview",
            azure_endpoint=self.endpoint
        )
        
        images = self._pdf_to_images(pdf_path)
        
        image_content = []
        for img in images:
            image_content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['mime_type']};base64,{img['base64']}",
                    "detail": "high"
                }
            })
        
        response = client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert at extracting educational content from textbooks."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": self._get_extraction_prompt()},
                        *image_content
                    ]
                }
            ],
            max_tokens=4096,
            temperature=0.1
        )
        
        result_text = response.choices[0].message.content.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# AWS Bedrock (Claude) Implementation
# ============================================================

class BedrockExtractor(BaseGenAIExtractor):
    """Extract using AWS Bedrock"""
    
    def __init__(self, region: str = "us-east-1"):
        super().__init__()
        self.region = region
        self.model_name = "anthropic.claude-3-sonnet-20240229-v1:0"
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        import boto3
        
        client = boto3.client('bedrock-runtime', region_name=self.region)
        images = self._pdf_to_images(pdf_path)
        
        # Prepare content for Bedrock Claude
        content = []
        for img in images:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img['mime_type'],
                    "data": img['base64']
                }
            })
        
        content.append({
            "type": "text",
            "text": self._get_extraction_prompt()
        })
        
        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ]
        })
        
        response = client.invoke_model(
            modelId=self.model_name,
            body=body
        )
        
        result = json.loads(response['body'].read())
        result_text = result['content'][0]['text'].strip()
        
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# Ollama (Local) Implementation
# ============================================================

class OllamaExtractor(BaseGenAIExtractor):
    """Extract using local Ollama models (LLaVA, Bakllava, etc.)"""
    
    def __init__(self, model: str = "llava:13b", host: str = "[localhost](http://localhost:11434)"):
        super().__init__()
        self.model_name = model
        self.host = host
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        import requests
        
        images = self._pdf_to_images(pdf_path)
        
        # Ollama expects images as base64 strings in a list
        image_data = [img['base64'] for img in images]
        
        response = requests.post(
            f"{self.host}/api/generate",
            json={
                "model": self.model_name,
                "prompt": self._get_extraction_prompt(),
                "images": image_data,
                "stream": False,
                "options": {
                    "temperature": 0.1
                }
            }
        )
        
        result = response.json()
        result_text = result['response'].strip()
        
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# LangChain Universal Implementation
# ============================================================

class LangChainExtractor(BaseGenAIExtractor):
    """Extract using LangChain (supports multiple providers)"""
    
    def __init__(self, provider: str = "openai", **kwargs):
        super().__init__()
        self.provider = provider
        self.kwargs = kwargs
    
    def _get_llm(self):
        """Get LangChain LLM based on provider"""
        if self.provider == "openai":
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model="gpt-4o",
                temperature=0.1,
                max_tokens=4096
            )
        elif self.provider == "google":
            from langchain_google_genai import ChatGoogleGenerativeAI
            return ChatGoogleGenerativeAI(
                model="gemini-1.5-pro",
                temperature=0.1,
                max_tokens=4096
            )
        elif self.provider == "anthropic":
            from langchain_anthropic import ChatAnthropic
            return ChatAnthropic(
                model="claude-sonnet-4-20250514",
                temperature=0.1,
                max_tokens=4096
            )
        else:
            raise ValueError(f"Unknown provider: {self.provider}")
    
    def extract_from_pdf(self, pdf_path: str) -> dict:
        from langchain_core.messages import HumanMessage
        
        llm = self._get_llm()
        images = self._pdf_to_images(pdf_path)
        
        # Prepare content
        content = [{"type": "text", "text": self._get_extraction_prompt()}]
        
        for img in images:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{img['mime_type']};base64,{img['base64']}"
                }
            })
        
        message = HumanMessage(content=content)
        response = llm.invoke([message])
        
        result_text = response.content.strip()
        if result_text.startswith("```json"):
            result_text = result_text[7:]
        if result_text.startswith("```"):
            result_text = result_text[3:]
        if result_text.endswith("```"):
            result_text = result_text[:-3]
        
        return json.loads(result_text)


# ============================================================
# Unified Extractor (Auto-select best available)
# ============================================================

class UnifiedPDFExtractor:
    """
    Unified extractor that automatically selects the best available GenAI model
    """
    
    PROVIDERS = {
        "openai": (OpenAIExtractor, "OPENAI_API_KEY"),
        "google": (GeminiExtractor, "GOOGLE_API_KEY"),
        "anthropic": (ClaudeExtractor, "ANTHROPIC_API_KEY"),
        "azure": (AzureOpenAIExtractor, "AZURE_OPENAI_API_KEY"),
    }
    
    def __init__(self, provider: str = None, **kwargs):
        """
        Initialize with specific provider or auto-detect
        
        Args:
            provider: One of 'openai', 'google', 'anthropic', 'azure', 'bedrock', 'ollama'
            **kwargs: Provider-specific arguments
        """
        if provider:
            self.extractor = self._get_extractor(provider, **kwargs)
        else:
            self.extractor = self._auto_detect_extractor()
    
    def _get_extractor(self, provider: str, **kwargs) -> BaseGenAIExtractor:
        """Get extractor for specific provider"""
        if provider == "openai":
            return OpenAIExtractor(**kwargs)
        elif provider == "google":
            return GeminiExtractor(**kwargs)
        elif provider == "anthropic":
            return ClaudeExtractor(**kwargs)
        elif provider == "azure":
            return AzureOpenAIExtractor(**kwargs)
        elif provider == "bedrock":
            return BedrockExtractor(**kwargs)
        elif provider == "ollama":
            return OllamaExtractor(**kwargs)
        elif provider == "langchain":
            return LangChainExtractor(**kwargs)
        else:
            raise ValueError(f"Unknown provider: {provider}")
    
    def _auto_detect_extractor(self) -> BaseGenAIExtractor:
        """Auto-detect available API keys and return appropriate extractor"""
        for provider, (extractor_class, env_var) in self.PROVIDERS.items():
            if os.getenv(env_var):
                print(f"✅ Auto-detected {provider} API key")
                return extractor_class()
        
        # Check for Ollama
        try:
            import requests
            response = requests.get("[localhost](http://localhost:11434/api/tags)", timeout=2)
            if response.status_code == 200:
                print("✅ Auto-detected local Ollama instance")
                return OllamaExtractor()
        except:
            pass
        
        raise ValueError(
            "No API keys found! Set one of: OPENAI_API_KEY, GOOGLE_API_KEY, "
            "ANTHROPIC_API_KEY, AZURE_OPENAI_API_KEY, or run Ollama locally"
        )
    
    def extract(self, pdf_path: str) -> dict:
        """Extract content from PDF"""
        print(f"📄 Processing: {pdf_path}")
        print(f"🤖 Using: {self.extractor.model_name}")
        
        result = self.extractor.extract_from_pdf(pdf_path)
        
        print(f"✅ Extracted {len(result.get('exercises', {}).get('questions', []))} questions")
        return result
    
    def extract_and_save(self, pdf_path: str, output_path: str = None) -> dict:
        """Extract and save to JSON"""
        result = self.extract(pdf_path)
        
        if output_path is None:
            output_path = Path(pdf_path).stem + "_extracted.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"💾 Saved to: {output_path}")
        return result


# ============================================================
# Main Execution
# ============================================================

def main():
    import sys
    
    # Get PDF path
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = "Chapter_5000.pdf"
    
    # Get provider (optional)
    provider = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Check if PDF exists
    if not Path(pdf_path).exists():
        print(f"❌ PDF not found: {pdf_path}")
        print("\n📝 Creating demo with sample prompt...")
        
        # Demo: Show what the prompt looks like
        demo_extractor = BaseGenAIExtractor.__subclasses__()[0]
        print("\n" + "="*60)
        print("EXTRACTION PROMPT:")
        print("="*60)
        print(demo_extractor(None)._get_extraction_prompt())
        return
    
    try:
        # Create extractor and process
        extractor = UnifiedPDFExtractor(provider=provider)
        result = extractor.extract_and_save(pdf_path)
        
        # Print result
        print("\n" + "="*60)
        print("EXTRACTED CONTENT:")
        print("="*60)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"❌ Error: {e}")
        raise


if __name__ == "__main__":
    main()
