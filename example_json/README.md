# example_json

这里放的是**教师端“数据导入·JSON”**页面可直接使用的示例文件。

## 成绩导入
- **接口**：`POST /scores/import`
- **前端入口**：教师端 → `数据导入 · JSON` → `成绩导入`
- **示例文件**：`scores_import_example_cet4.json`、`scores_import_example_cet6.json`

## 背诵导入
- **接口**：`POST /recitations/import`
- **前端入口**：教师端 → `数据导入 · JSON` → `背诵导入`
- **支持两种格式**：
  - `records`：一条记录=某学生某天背诵量（更通用）
  - `students.daily`：按学生聚合（更像字典）
- **示例文件**：`recitations_import_records_example.json`、`recitations_import_students_daily_example.json`



