import json
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

tokenizer = AutoTokenizer.from_pretrained(
    "line-corporation/japanese-large-lm-3.6b-instruction-sft", use_fast=False
)
model = AutoModelForCausalLM.from_pretrained(
    "line-corporation/japanese-large-lm-3.6b-instruction-sft"
)
generator = pipeline("text-generation", model=model, tokenizer=tokenizer, device=0)
print(type(tokenizer.pad_token_id))


class CustomHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == "/chat_completion":
            content_length = int(self.headers["Content-Length"])
            post_data = self.rfile.read(content_length).decode("utf-8")
            try:
                post_data_json = json.loads(post_data)
                prompt = post_data_json.get("prompt")
                if prompt:
                    text = generator(
                        prompt,
                        max_length=256,
                        do_sample=True,
                        temperature=0.5,
                        top_p=0.9,
                        repetition_penalty=1.1,
                        pad_token_id=tokenizer.pad_token_id,
                        num_return_sequences=1,
                    )
                    print(text)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(text, ensure_ascii=False).encode("utf-8"))
                else:
                    self.send_error(400, "prompt parameter is missing")
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON format")


server_address = ("localhost", 8888)
httpd = HTTPServer(server_address, CustomHTTPRequestHandler)
print(f"Serving on http://{server_address[0]}:{server_address[1]} ...")
httpd.serve_forever()
