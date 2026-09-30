import os
from pypdf import PdfReader
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

class RAGQuizService:
    def __init__(self, model_path="./fine_tuned_quiz_model"):
        candidate_paths = [
            model_path,
            os.path.abspath(model_path),
            os.path.join(os.path.dirname(__file__), "fine_tuned_quiz_model"),
            os.path.abspath(os.path.join(os.getcwd(), "quiz-backend", "fine_tuned_quiz_model")),
            os.path.abspath(os.path.join(os.getcwd(), "fine_tuned_quiz_model")),
        ]
        resolved_path = None
        for cp in candidate_paths:
            if os.path.exists(cp):
                resolved_path = os.path.abspath(cp)
                break
        path_to_use = resolved_path or model_path
        print(f"🤖 Loading model for RAG service from {path_to_use}...")
        self.tokenizer = AutoTokenizer.from_pretrained(path_to_use)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(path_to_use)

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """PDF ෆයිල් එකකින් සියලුම පෙළ (Text) කියවා ගැනීම"""
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text

    def chunk_text(self, text: str, chunk_size: int = 500) -> list:
        """පෙළ කොටස් (Chunks) වලට වෙන් කර ගැනීම"""
        words = text.split()
        chunks = []
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
        return chunks

    def generate_quiz_from_pdf(self, pdf_path: str) -> list:
        """PDF එකක් දීපුවම ඒකෙන් ප්‍රශ්න generate කර ගැනීම"""
        raw_text = self.extract_text_from_pdf(pdf_path)
        chunks = self.chunk_text(raw_text)
        
        generated_questions = []
        # පළමු කොටස් කිහිපය සඳහා ප්‍රශ්න සාදාගමු (വേගවත් වීම සඳහා)
        for chunk in chunks[:3]: 
            input_text = f"generate question: {chunk}"
            inputs = self.tokenizer(input_text, return_tensors="pt", max_length=256, truncation=True)
            
            outputs = self.model.generate(
                inputs["input_ids"],
                max_length=64,
                num_beams=4,
                no_repeat_ngram_size=2,
                early_stopping=True
            )
            
            question = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            generated_questions.append({
                "context_snippet": chunk[:150] + "...",
                "question": question
            })
            
        return generated_questions