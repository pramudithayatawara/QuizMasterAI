import os
from datasets import load_dataset
from transformers import (
    AutoTokenizer,
    AutoModelForSeq2SeqLM,
    DataCollatorForSeq2Seq,
    Seq2SeqTrainer,
    Seq2SeqTrainingArguments
)

def train_quiz_model():
    print("📥 Step 1: Loading SciQ educational dataset...")
    # පරීක්ෂාව සඳහා සහ වේගවත් ක්‍රියාකාරිත්වය සඳහා පළමු 1000 data පමණක් ගනිමු
    dataset = load_dataset("sciq", split="train[:1000]")
    
    # Dataset එක Train සහ Test විදිහට බෙදා වෙන් කරමු (80% train, 20% test)
    split_dataset = dataset.train_test_split(test_size=0.2)
    
    print("🤖 Step 2: Loading Pre-trained Model & Tokenizer (Flan-T5-small)...")
    model_name = "google/flan-t5-small"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
    
    # Prompt එක සකස් කරමින් Data tokenize කිරීමේ function එක
    def preprocess_function(examples):
        inputs = [f"generate question: {context}" for context in examples["support"]]
        targets = [question for question in examples["question"]]
        
        model_inputs = tokenizer(inputs, max_length=256, truncation=True, padding="max_length")
        labels = tokenizer(targets, max_length=64, truncation=True, padding="max_length")
        
        model_inputs["labels"] = labels["input_ids"]
        return model_inputs

    print("⚙️ Step 3: Tokenizing dataset...")
    tokenized_datasets = split_dataset.map(preprocess_function, batched=True)
    
    print("🚀 Step 4: Setting up Training Arguments...")
    training_args = Seq2SeqTrainingArguments(
        output_dir="./results",
        eval_strategy="epoch",
        learning_rate=5e-5,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        weight_decay=0.01,
        save_total_limit=2,
        num_train_epochs=1,
        predict_with_generate=True,
        logging_dir="./logs",
        logging_steps=10,
    )
    
    data_collator = DataCollatorForSeq2Seq(tokenizer, model=model)
    
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_datasets["train"],
        eval_dataset=tokenized_datasets["test"],
        tokenizer=tokenizer,
        data_collator=data_collator,
    )
    
    print("🔥 Step 5: Starting Model Fine-Tuning...")
    trainer.train()
    
    # Fine-tune කරගත් Model එක save කරගැනීම
    save_path = "./fine_tuned_quiz_model"
    model.save_pretrained(save_path)
    tokenizer.save_pretrained(save_path)
    print(f"✅ Model successfully trained and saved to {save_path}!")

if __name__ == "__main__":
    train_quiz_model()