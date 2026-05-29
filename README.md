# Life Log (生活日志)

一个简洁的个人时间追踪 Web 应用，帮助你记录和回顾每天的时间分配。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + Vite + TypeScript |
| 后端 | FastAPI + SQLAlchemy |
| 数据库 | SQLite (aiosqlite 异步驱动) |
| 部署 | Docker Compose + Nginx |

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 克隆项目
git clone <repo-url>
cd life-log

# 启动所有服务
docker compose up

# 后台运行
docker compose up -d

# 停止服务
docker compose down
```

启动后访问：
- 前端：http://localhost:3000
- 后端 API：http://localhost:8000
- API 文档：http://localhost:8000/docs

### 开发环境

如果你需要分别运行前端和后端进行开发：

**后端**

```bash
cd backend

# 创建虚拟环境
python -m venv .venv
source .venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload --port 8000
```

**前端**

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器（端口 5173）
npm run dev
```

开发模式下，前端运行在 http://localhost:5173，后端运行在 http://localhost:8000。

## 项目结构

```
life-log/
├── backend/             # 后端 FastAPI 应用
│   ├── Dockerfile
│   ├── main.py          # 应用入口
│   ├── models.py        # SQLAlchemy 数据模型
│   ├── requirements.txt
│   └── ...
├── frontend/            # 前端 React 应用
│   ├── Dockerfile
│   ├── src/
│   ├── package.json
│   └── ...
├── data/                # SQLite 数据库文件目录
│   └── .gitkeep
├── docker-compose.yml   # Docker Compose 编排配置
├── .gitignore
└── README.md
```

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/v1/entries` | 获取时间记录列表 |
| `POST` | `/api/v1/entries` | 创建新的时间记录 |
| `GET` | `/api/v1/entries/{id}` | 获取单条时间记录 |
| `PUT` | `/api/v1/entries/{id}` | 更新时间记录 |
| `DELETE` | `/api/v1/entries/{id}` | 删除时间记录 |
| `GET` | `/api/v1/categories` | 获取分类列表 |
| `POST` | `/api/v1/categories` | 创建分类 |
| `GET` | `/api/v1/tags` | 获取标签列表 |

完整的交互式 API 文档请访问：http://localhost:8000/docs

## 许可证

[MIT](LICENSE)
