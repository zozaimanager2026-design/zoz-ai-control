import spaces
import gradio as gr
import torch
from diffusers import DiffusionPipeline

MODEL_ID = "Qwen/Qwen-Image"

pipe = DiffusionPipeline.from_pretrained(MODEL_ID, torch_dtype=torch.bfloat16)
pipe.to("cuda")

@spaces.GPU(duration=120)
def generate(prompt: str, negative_prompt: str = "", width: int = 1024, height: int = 1024, steps: int = 28, guidance: float = 4.0):
    """Generate a ZOZ-branded image using the ZOZ native self-hosted renderer."""
    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt or None,
        width=int(width),
        height=int(height),
        num_inference_steps=int(steps),
        guidance_scale=float(guidance),
    )
    return result.images[0]

demo = gr.Interface(
    fn=generate,
    inputs=[
        gr.Textbox(label="Prompt"),
        gr.Textbox(label="Negative prompt"),
        gr.Slider(512, 1536, value=1024, step=64, label="Width"),
        gr.Slider(512, 1536, value=1024, step=64, label="Height"),
        gr.Slider(8, 40, value=28, step=1, label="Steps"),
        gr.Slider(1, 8, value=4, step=0.5, label="Guidance"),
    ],
    outputs=gr.Image(type="pil"),
    title="ZOZ Native Image Renderer",
    description="ZOZ Creative Engine GPU renderer. No commercial image-generation API.",
)
demo.launch(mcp_server=True)
