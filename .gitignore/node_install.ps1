cd D:\GitPage
node -v
npm -v

# create package.json (if missing)
if (-not (Test-Path package.json)) { npm init -y }

# set package type to module so 'import' syntax works
node -e "$p=require('./package.json'); $p.type='module'; require('fs').writeFileSync('package.json', JSON.stringify($p,null,2));"
npm install express cors body-parser node-fetch@3