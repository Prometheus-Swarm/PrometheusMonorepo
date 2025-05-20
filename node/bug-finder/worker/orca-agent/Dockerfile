FROM python:3.12-slim
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_PYTHON_VERSION_WARNING=1 \
    PYTHONUNBUFFERED=1 \
    TERM=xterm-256color \
    DATABASE_PATH=/data/database.db \
    MIDDLE_SERVER_URL=https://ik8kcow8ksw8gwgoo0ggosko.dev.koii.network

RUN apt-get update && apt-get install -y --no-install-recommends \
    git gcc g++ make \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch==2.7.0+cpu onnxruntime==1.21.1 \
    && pip install -r requirements.txt

COPY . .

RUN git config --global --add safe.directory /app

EXPOSE 8080
CMD ["gunicorn", "-w", "1", "-b", "0.0.0.0:8080", "main:app"]