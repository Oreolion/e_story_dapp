import { exec } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

async function main() {
  console.error("🔧 EDIT HOOK TRIGGERED");
  
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  
  const toolArgs = JSON.parse(Buffer.concat(chunks).toString());
  
  console.error("Tool args:", JSON.stringify(toolArgs, null, 2));
  
  // Extract the file path that was edited
  const editedPath =
    toolArgs.tool_input?.file_path || 
    toolArgs.tool_input?.path || 
    toolArgs.path ||
    "";
  
  console.error("File edited:", editedPath);
  
  // Only run type checking for TypeScript/JavaScript files
  const isTypeScriptFile = /\.(ts|tsx|js|jsx)$/i.test(editedPath);
  
  if (!isTypeScriptFile) {
    console.error("✅ Not a TS/JS file, skipping type check");
    process.exit(0);
    return;
  }
  
  console.error("🔍 Running TypeScript compiler...");
  
  // Run TypeScript compiler
  exec('npx tsc --noEmit', { cwd: resolve(fileURLToPath(new URL('..', import.meta.url))) }, (error, stdout, stderr) => {
    if (error) {
      // Type errors found
      const errors = stderr || stdout || error.message;
      
      console.error("❌ TYPE ERRORS FOUND:");
      console.error(errors);
      
      // Output errors for Claude to see
      console.log("\n⚠️  TYPE CHECK FAILED - Please fix the following errors:\n");
      console.log(errors);
      
      // Exit with code 1 to signal that there are issues to fix
      // But don't block the edit (use exit code 0 if you want Claude to see but continue)
      process.exit(0); // Change to exit(1) if you want to block the edit
      return;
    }
    
    // No type errors
    console.error("✅ TYPE CHECK PASSED");
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Hook error:", err);
  process.exit(1);
});
