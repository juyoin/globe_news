import spacy
nlp = spacy.load("en_core_web_sm")
print(nlp.meta['version'])  # Should output '3.7.1' or equivalent