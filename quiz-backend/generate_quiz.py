import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

def generate_question_from_text(context_text: str):
    print("🤖 Loading fine-tuned model for quiz generation...")
    model_path = "./fine_tuned_quiz_model"
    
    # Model එක සහ Tokenizer එක load කරගැනීම
    tokenizer = AutoTokenizer.from_pretrained(model_path)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
    
    # Input text එක model එකට හරියන format එකට සකස් කිරීම
    input_text = f"generate question: {context_text}"
    inputs = tokenizer(input_text, return_tensors="pt", max_length=256, truncation=True)
    
    print("⚙️ Generating question...")
    # ප්‍රශ්නය Generate කරගැනීම
    outputs = model.generate(
        inputs["input_ids"],
        max_length=64,
        num_beams=4,
        no_repeat_ngram_size=2,
        early_stopping=True
    )
    
    # Output token IDs නැවත Text බවට හැරවීම
    generated_question = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return generated_question

if __name__ == "__main__":
    # උදාහරණයක් සඳහා text එකක් දීලා පරීක්ෂා කරමු
    sample_context = "Photosynthesis is the process used by plants to convert light energy into chemical energy."
    question = generate_question_from_text(sample_context)
    print(f"\n✅ Context: {sample_context}")
    print(f"❓ Generated Question: {question}")