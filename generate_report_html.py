import os
import re

md_path = '/Users/user/Desktop/RUSL_reserch/QuizMasterAI/EC06_Revised_RAG_Quiz_System_Report.md'
html_path = '/Users/user/Desktop/RUSL_reserch/QuizMasterAI/EC06_Revised_RAG_Quiz_System_Report.html'

with open(md_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EC06 Revised Report - QuizMaster AI</title>
<style>
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
    max-width: 960px;
    margin: 40px auto;
    padding: 0 25px;
    background-color: #fff;
  }
  .header-box {
    text-align: center;
    border-bottom: 3px double #cbd5e1;
    padding-bottom: 25px;
    margin-bottom: 35px;
  }
  .header-box h1 { font-size: 24px; color: #0f172a; margin-bottom: 6px; }
  .header-box h2 { font-size: 17px; color: #475569; font-weight: 500; margin-top: 0; }
  .header-box h3 { font-size: 15px; color: #64748b; font-weight: normal; margin-top: 0; }
  .report-tag {
    display: inline-block;
    background: #1e40af;
    color: #fff;
    padding: 6px 16px;
    border-radius: 4px;
    font-weight: bold;
    font-size: 16px;
    margin-top: 15px;
    letter-spacing: 0.5px;
  }
  h2 {
    color: #1e3a8a;
    border-bottom: 2px solid #e2e8f0;
    padding-bottom: 8px;
    margin-top: 40px;
    font-size: 20px;
  }
  h3 { color: #334155; margin-top: 25px; font-size: 16px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 9px 12px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background-color: #f1f5f9;
    font-weight: 600;
    color: #0f172a;
  }
  tr:nth-child(even) { background-color: #f8fafc; }
  pre {
    background-color: #0f172a;
    color: #f8fafc;
    border-radius: 6px;
    padding: 16px;
    overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  code {
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .badge-c { background-color: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 10px; font-weight: 600; font-size: 11px; }
  .badge-pc { background-color: #fef9c3; color: #854d0e; padding: 3px 8px; border-radius: 10px; font-weight: 600; font-size: 11px; }
  .badge-sp { background-color: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 10px; font-weight: 600; font-size: 11px; }
  @media print {
    body { max-width: 100%; margin: 0; padding: 12mm; font-size: 10pt; }
    h2 { page-break-before: always; }
    table { font-size: 8.5pt; }
    pre { font-size: 8pt; background-color: #f1f5f9; color: #000; border: 1px solid #ccc; }
  }
</style>
</head>
<body>
<div class="header-box">
  <h1>RAJARATA UNIVERSITY OF SRI LANKA</h1>
  <h2>Faculty of Applied Sciences — Department of Computing</h2>
  <h3>ICT 3411 &amp; COM 3405: ICT / CS Group Project</h3>
  <div class="report-tag">EC06 – PROJECT IMPLEMENTATION PHASE III REPORT (REVISED)</div>
</div>
"""

in_table = False
in_pre = False

for line in lines:
    line_s = line.strip()
    
    if line_s.startswith('```'):
        if in_pre:
            html_content += '</pre>\n'
            in_pre = False
        else:
            html_content += '<pre>'
            in_pre = True
        continue
    if in_pre:
        html_content += line.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        continue
        
    if line_s.startswith('|') and line_s.endswith('|'):
        cols = [c.strip() for c in line_s[1:-1].split('|')]
        if all(re.match(r'^:?-+:?$', c) for c in cols):
            continue
        if not in_table:
            html_content += '<table>\n<thead><tr>' + ''.join(f'<th>{c}</th>' for c in cols) + '</tr></thead>\n<tbody>\n'
            in_table = True
        else:
            formatted_cols = []
            for c in cols:
                c_clean = c
                if 'Completed' in c and 'Partially' not in c:
                    c_clean = c.replace('Completed', '<span class="badge-c">Completed</span>').replace('**', '')
                elif 'Partially Completed' in c:
                    c_clean = c.replace('Partially Completed', '<span class="badge-pc">Partially Completed</span>').replace('**', '')
                elif 'Planned' in c or 'Simulated' in c:
                    c_clean = c.replace('**', '')
                    c_clean = f'<span class="badge-sp">{c_clean}</span>'
                c_clean = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', c_clean)
                c_clean = re.sub(r'`(.*?)`', r'<code>\1</code>', c_clean)
                formatted_cols.append(c_clean)
            html_content += '<tr>' + ''.join(f'<td>{c}</td>' for c in formatted_cols) + '</tr>\n'
        continue
    else:
        if in_table:
            html_content += '</tbody></table>\n'
            in_table = False

    if line.startswith('# '):
        continue
    elif line.startswith('## '):
        html_content += f'<h2>{line[3:].strip()}</h2>\n'
    elif line.startswith('### '):
        html_content += f'<h3>{line[4:].strip()}</h3>\n'
    elif line.startswith('---'):
        html_content += '<hr style="border:none; border-top:1px solid #e2e8f0; margin:30px 0;">\n'
    elif line_s:
        p_text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', line_s)
        p_text = re.sub(r'`(.*?)`', r'<code>\1</code>', p_text)
        if p_text.startswith('* '):
            html_content += f'<ul><li>{p_text[2:]}</li></ul>\n'
        else:
            html_content += f'<p>{p_text}</p>\n'

if in_table:
    html_content += '</tbody></table>\n'
if in_pre:
    html_content += '</pre>\n'

html_content += '</body></html>'

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html_content)

print('Done generating HTML report')
