🚀 Overview

This project is a multilingual one-page website built with modern frontend tools.
The structure is optimized for both performance and mobile responsiveness.
All revisions are developed locally in VS Code and synced to GitHub, then deployed to the hosting environment.

🌍 Features

Multi-language support (TR / DE / EN)

IP-based language redirection (TR → Turkish, EU countries → German, others → English)

Fully responsive UI

Smooth scroll navigation

Easy deployment workflow

GitHub → Hosting automatic sync (Lovable)

📁 Tech Stack

HTML5 / CSS3 / JavaScript

Lovable.dev (AI code generation & hosting)

GitHub (version control)

VS Code (local development)

FTP Deployment (GoDaddy)

🧩 Project Structure
/public_html
│── index.html
│── styles/
│     └── style.css
│── assets/
│     ├── images/
│     └── icons/
│── scripts/
│     └── app.js
└── readme.md

🔄 Development Workflow

Clone the repo to your computer

git clone https://github.com/username/project.git


Make revisions in VS Code

Update HTML sections

Adjust CSS

Add new components

Modify language files

Commit & Push

git add .
git commit -m "UI improvements + new language logic"
git push origin main


Automatic Sync

Lovable immediately reflects the changes

No manual upload needed

Production Deployment

npm install
npm run build


Then send the dist/ folder to GoDaddy via FTP (deploy@dayandisli.com
).

🌐 IP-Based Language Routing

The site detects visitors’ country by IP and loads the correct language:

IP Region	Language
Turkey	🇹🇷 Turkish
Germany / Netherlands / Austria / Switzerland	🇩🇪 German
Other Countries	🇬🇧 English

If VPN is active, language will adapt accordingly.

🔧 Installation

If you want to customize locally:

npm install
npm run dev


Project starts at:
http://localhost:3000

📦 Build for Production
npm run build


Output folder:

/dist


Upload /dist to hosting via FTP.

📞 Support

<<<<<<< HEAD
For questions or improvements, feel free to open an Issue or send a Pull Request.
=======
For questions or improvements, feel free to open an Issue or send a Pull Request.
>>>>>>> a96e57d (FLAGS)
