### 四六级学生考试管理系统（CET 4/6 Management System）

本项目是一个面向高校四六级考试场景的**学生端 + 教师/管理员端**管理系统，覆盖：

- 学生：登录、背诵打卡（GitHub 热图）、个人成绩查询、报考资格判断（四过可报六）
- 教师/管理员：学生信息 CRUD、成绩导入（JSON）、背诵导入（JSON）、班级统计分析（通过率/均分/最高最低）与图表导出、数据造数/演示

> 说明：当前仓库为课程项目形态，功能以“可演示 + 可扩展”为目标，后续可逐步完善为完整的报名审批、考场分配等教务流程。

---

### 技术栈

- **后端**：NestJS（TypeScript）+ Prisma + PostgreSQL
- **前端**：Vue 3 + Vite + Naive UI + ECharts
- **鉴权**：Bearer Token（开发环境简化 JWT-HS256），支持“前端 SHA-256 后再提交”避免明文出现在请求体

---

### 项目目录结构

```text
.
├─ backend/                 # NestJS API + Prisma
│  ├─ prisma/schema.prisma   # 数据模型
│  ├─ src/modules/           # 模块：auth/scores/recitations/reports/students 等
│  └─ scripts/               # 开发用造数/修正脚本
├─ frontend/                # Vue3 Web
│  ├─ src/views/             # Login/Student/Teacher 等页面
│  └─ src/components/        # 图表、热图、CRUD等组件
└─ example_json/             # JSON 导入示例（成绩/背诵）
```

---

### 功能概览

#### 学生端（/student）

- **背诵打卡 & 热图**：按天打卡，自动渲染 GitHub 风格热图（0 空白；非 0 分级颜色，支持伪随机变化/自适应分级）
- **成绩 & 报考资格**：
  - `GET /scores/me`：个人成绩列表（按考试批次倒序）
  - `GET /scores/me/eligibility`：是否过四级、是否可报名六级（默认通过线 425）

#### 教师端（/teacher）

- **数据导入（JSON）**
  - 成绩导入：`POST /scores/import`
  - 背诵导入：`POST /recitations/import`
  - 示例文件见 `example_json/`
- **成绩统计（班级维度）**
  - `GET /reports/class-stats?examType=CET4|CET6`
  - 输出：通过率/均分/最高/最低等，并支持图表导出 PNG（用于“正经报表图片”）
- **学生管理（CRUD）**
  - `GET/POST/PATCH/DELETE /students`
  - 前端提供表格 + 搜索 + 新增/编辑弹窗 + 删除确认（删除会级联删除成绩/背诵等数据）
- **背诵管理（教师代录/查看）**
  - `GET /recitations/student/:studentId`
  - `POST /recitations/student/:studentId`

---

### 运行前准备（端口与依赖）

- **PostgreSQL**：默认端口 `5432`（你本机已监听则可直接用）
- **后端 API**：默认端口 `3000`
- **前端 Web**：默认端口 `5173`

前端默认把后端地址设置为：

- `frontend/src/lib/api.ts`：`VITE_API_BASE || http://localhost:3000`

如果你不是在同一台机器访问（例如手机/另一台电脑访问前端），一定要把 `VITE_API_BASE` 指向后端真实 IP，否则会出现“页面没东西/接口 401/连接拒绝”等现象。

---

### 启动方式（推荐顺序）

#### 1) 启动数据库（PostgreSQL）

确保 PostgreSQL 已启动，并有一个数据库（例如 `cet_nextgen`）。本仓库以前用过 `docker-compose`，但你当前环境不一定有 Docker，建议直接使用本机 Postgres 服务。

#### 2) 启动后端（NestJS）

```bash
cd /home/plote/cet_46/backend
npm install --no-audit --no-fund
npm run prisma:generate
npx prisma db push
npm run start:dev
```

验证：

```bash
curl http://localhost:3000/health
```

#### 3) 启动前端（Vite）

```bash
cd /home/plote/cet_46/frontend
npm install --no-audit --no-fund
npm run dev
```

打开 `http://localhost:5173`。

---

### 登录与演示账号

系统分为学生端/教师端登录，并按角色路由：

- 学生登录成功进入 `/student`
- 教师登录成功进入 `/teacher`

#### 开发环境一键创建演示账号

后端提供开发接口：

- `POST /auth/dev/seed-demo`：创建/更新几组教师账号 + 学生账号（用于快速登录）
- `POST /auth/dev/seed-demo-data`：生成一批演示数据（学生/成绩/背诵）

> 你也可以直接用登录页按钮“生成默认教师账号/演示账号”（教师端）。

---

### JSON 导入（成绩/背诵）

教师端 → **数据导入 · JSON**：

- **成绩导入**：`POST /scores/import`
  - 示例：`example_json/scores_import_example_cet4.json`、`example_json/scores_import_example_cet6.json`
- **背诵导入**：`POST /recitations/import`
  - 支持 `records` 或 `students.daily` 两种格式
  - 示例：`example_json/recitations_import_records_example.json`、`example_json/recitations_import_students_daily_example.json`

更详细说明见：`example_json/README.md`

---

### 常用开发脚本（backend/scripts）

仓库包含一批用于“造数/修正数据分布”的脚本，便于演示：

- `backend/scripts/seed_500_students.js`：批量生成 500 个学生及成绩/背诵（用于压测与看效果）
- `backend/scripts/adjust_seeded_students_classes_scores.js`：把已生成数据重新分班（含“人工智能 1/2 班”）
- `backend/scripts/adjust_score_distributions.js`：把 CET4/CET6 的均分调整到目标值附近（例如四级≈500、六级≈430）并保持方差大
- `backend/scripts/update_zhangtianshan.js`：更新xxx示例数据（姓名/成绩/背诵热图）

运行示例：

```bash
cd /home/plote/cet_46/backend
node scripts/seed_500_students.js
```

---

### 安全说明（重要）

- 系统实现了“前端 SHA-256 后再提交”的登录方式，以避免明文出现在请求体。
- **但这不是 HTTPS 的替代**：如果没有 HTTPS，哈希值仍可能被抓包重放（等价于密码）。
- 正式部署建议：强制 HTTPS、使用更规范的密码哈希（PBKDF2/Bcrypt/Argon2）与更完整的会话策略（刷新 token/吊销等）。

---

### 常见问题排查（FAQ）

#### 1) 只启动前端看不到数据/CRUD/统计

原因：这些功能依赖后端接口与数据库。请确认：

- 后端 `http://localhost:3000/health` 返回 `ok`
- 数据库端口 `5432` 正常
- 前端 `VITE_API_BASE` 是否指向正确后端地址

#### 2) 教师端看不到“删除/编辑”按钮

学生管理表格列较多时，操作列可能被挤到右侧。我们已将“操作列”固定在右侧（fixed right），仍建议：

- Ctrl+F5 强刷
- 确认已登录教师账号（学生账号无权访问教师端功能）

#### 3) 401/403 权限错误

- 没登录或 token 过期：退出后重新登录
- 用学生账号访问教师接口：请切换教师端登录

---

### 后续可扩展方向（建议）

- Excel/CSV 导入（导入预览、错误行定位、重复策略）
- 完整报名流程（提交—审核—导出名单—通知）
- 考场自动分配（预览—确认落库—导出座位表）
- 更完整的审计日志与权限矩阵（多管理员角色）

---

### License

课程项目用途，默认未附带开源许可证；如需开源请补充 LICENSE 文件与第三方依赖声明。
