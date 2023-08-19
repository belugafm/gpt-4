import json
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("matsuo-lab/weblab-10b-instruction-sft")
model = AutoModelForCausalLM.from_pretrained(
    "matsuo-lab/weblab-10b-instruction-sft",
    torch_dtype=torch.float16,
    device_map="auto",
)


# if torch.cuda.is_available():
#     model = model.to("cuda")


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
                    print(prompt)
                    token_ids = tokenizer.encode(
                        prompt, add_special_tokens=False, return_tensors="pt"
                    ).to(model.device)
                    with torch.no_grad():
                        output_ids = model.generate(
                            token_ids,
                            max_new_tokens=1024,
                            do_sample=True,
                            temperature=0.5,
                            repetition_penalty=1.1,
                            top_p=0.9,
                        )
                    text = tokenizer.decode(output_ids.tolist()[0], skip_special_tokens=True)
                    # print(text)
                    # text = text.replace("<|endoftext|>", "")
                    print(text)
                    result = [{"generated_text": text}]
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
                else:
                    self.send_error(400, "prompt parameter is missing")
            except json.JSONDecodeError:
                self.send_error(400, "Invalid JSON format")


server_address = ("localhost", 8888)
httpd = HTTPServer(server_address, CustomHTTPRequestHandler)
print(f"Serving on http://{server_address[0]}:{server_address[1]} ...")
httpd.serve_forever()
