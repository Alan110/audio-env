from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import uuid
from spleeter.separator import Separator
import numpy as np
import soundfile as sf
import shutil

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建临时文件夹
UPLOAD_DIR = "temp/uploads"
OUTPUT_DIR = "temp/separated"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.post("/separate")
async def separate_audio(audio: UploadFile = File(...)):
    try:
        # 生成唯一文件名
        file_id = str(uuid.uuid4())
        input_path = os.path.join(UPLOAD_DIR, f"{file_id}.wav")
        output_path = os.path.join(OUTPUT_DIR, file_id)
        
        # 保存上传的文件
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        # 初始化分离器
        separator = Separator('spleeter:5stems')
        
        # 进行音轨分离
        separator.separate_to_file(
            input_path,
            output_path,
            codec='wav'
        )
        
        # 构建分离后的音轨路径
        track_paths = {
            'vocals': f"/audio/{file_id}/vocals.wav",
            'drums': f"/audio/{file_id}/drums.wav",
            'bass': f"/audio/{file_id}/bass.wav",
            'guitar': f"/audio/{file_id}/other.wav",
            'other': f"/audio/{file_id}/piano.wav"
        }
        
        return track_paths
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 清理临时文件
        if os.path.exists(input_path):
            os.remove(input_path)

@app.get("/audio/{file_id}/{track_name}")
async def get_audio_file(file_id: str, track_name: str):
    file_path = os.path.join(OUTPUT_DIR, file_id, track_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="音频文件不存在")
    return FileResponse(file_path)

# 定时清理任务
@app.on_event("startup")
async def startup_event():
    cleanup_old_files()

def cleanup_old_files():
    # 清理超过24小时的文件
    import time
    current_time = time.time()
    
    for dir_path in [UPLOAD_DIR, OUTPUT_DIR]:
        for root, dirs, files in os.walk(dir_path):
            for name in files:
                file_path = os.path.join(root, name)
                if os.path.getmtime(file_path) < current_time - 86400:  # 24小时
                    os.remove(file_path) 