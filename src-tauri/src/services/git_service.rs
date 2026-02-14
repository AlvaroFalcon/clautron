use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub path: String,
    pub change_type: String, // "modified", "added", "deleted", "renamed"
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_type: String, // "add", "remove", "context"
    pub content: String,
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangedFile {
    pub path: String,
    pub status: String, // "M", "A", "D", "R", "?"
}

/// Get list of changed files in the working tree.
pub fn get_changed_files(project_dir: &str) -> Result<Vec<ChangedFile>, String> {
    // Get staged + unstaged + untracked
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to run git status: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut files = Vec::new();

    for line in stdout.lines() {
        if line.len() < 4 {
            continue;
        }
        let status = line[..2].trim().to_string();
        let path = line[3..].trim().to_string();
        files.push(ChangedFile { path, status });
    }

    Ok(files)
}

/// Get unified diff for specific files or all changes.
pub fn get_diff(
    project_dir: &str,
    paths: Option<Vec<String>>,
) -> Result<Vec<FileDiff>, String> {
    let mut diffs = Vec::new();

    // Get unstaged diffs
    let mut args = vec!["diff".to_string()];
    if let Some(ref paths) = paths {
        args.push("--".to_string());
        args.extend(paths.clone());
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    diffs.extend(parse_unified_diff(&stdout));

    // Get staged diffs
    let mut args = vec!["diff".to_string(), "--cached".to_string()];
    if let Some(ref paths) = paths {
        args.push("--".to_string());
        args.extend(paths.clone());
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Failed to run git diff --cached: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    diffs.extend(parse_unified_diff(&stdout));

    Ok(diffs)
}

/// Parse unified diff output into structured FileDiff objects.
fn parse_unified_diff(diff_output: &str) -> Vec<FileDiff> {
    let mut files = Vec::new();
    let mut current_file: Option<FileDiff> = None;
    let mut current_hunk: Option<DiffHunk> = None;
    let mut old_line: u32 = 0;
    let mut new_line: u32 = 0;

    for line in diff_output.lines() {
        if line.starts_with("diff --git") {
            // Save previous file
            if let Some(mut file) = current_file.take() {
                if let Some(hunk) = current_hunk.take() {
                    file.hunks.push(hunk);
                }
                files.push(file);
            }

            // Extract path from "diff --git a/path b/path"
            let parts: Vec<&str> = line.split(' ').collect();
            let path = if parts.len() >= 4 {
                parts[3].strip_prefix("b/").unwrap_or(parts[3]).to_string()
            } else {
                String::new()
            };

            current_file = Some(FileDiff {
                path,
                change_type: "modified".to_string(),
                hunks: Vec::new(),
            });
        } else if line.starts_with("new file") {
            if let Some(ref mut file) = current_file {
                file.change_type = "added".to_string();
            }
        } else if line.starts_with("deleted file") {
            if let Some(ref mut file) = current_file {
                file.change_type = "deleted".to_string();
            }
        } else if line.starts_with("rename") {
            if let Some(ref mut file) = current_file {
                file.change_type = "renamed".to_string();
            }
        } else if line.starts_with("@@") {
            // Save previous hunk
            if let Some(ref mut file) = current_file {
                if let Some(hunk) = current_hunk.take() {
                    file.hunks.push(hunk);
                }
            }

            // Parse @@ -old_start,old_count +new_start,new_count @@
            if let Some((old_start, new_start)) = parse_hunk_header(line) {
                old_line = old_start;
                new_line = new_start;
            }

            current_hunk = Some(DiffHunk {
                header: line.to_string(),
                lines: Vec::new(),
            });
        } else if let Some(ref mut hunk) = current_hunk {
            if line.starts_with('+') && !line.starts_with("+++") {
                hunk.lines.push(DiffLine {
                    line_type: "add".to_string(),
                    content: line[1..].to_string(),
                    old_line: None,
                    new_line: Some(new_line),
                });
                new_line += 1;
            } else if line.starts_with('-') && !line.starts_with("---") {
                hunk.lines.push(DiffLine {
                    line_type: "remove".to_string(),
                    content: line[1..].to_string(),
                    old_line: Some(old_line),
                    new_line: None,
                });
                old_line += 1;
            } else if line.starts_with(' ') || line.is_empty() {
                let content = if line.is_empty() {
                    String::new()
                } else {
                    line[1..].to_string()
                };
                hunk.lines.push(DiffLine {
                    line_type: "context".to_string(),
                    content,
                    old_line: Some(old_line),
                    new_line: Some(new_line),
                });
                old_line += 1;
                new_line += 1;
            }
        }
    }

    // Save last file
    if let Some(mut file) = current_file {
        if let Some(hunk) = current_hunk {
            file.hunks.push(hunk);
        }
        files.push(file);
    }

    files
}

fn parse_hunk_header(line: &str) -> Option<(u32, u32)> {
    // @@ -1,3 +1,4 @@
    let parts: Vec<&str> = line.split(' ').collect();
    if parts.len() < 4 {
        return None;
    }
    let old_start = parts[1]
        .strip_prefix('-')?
        .split(',')
        .next()?
        .parse::<u32>()
        .ok()?;
    let new_start = parts[2]
        .strip_prefix('+')?
        .split(',')
        .next()?
        .parse::<u32>()
        .ok()?;
    Some((old_start, new_start))
}
