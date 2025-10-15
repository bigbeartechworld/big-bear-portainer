import fs from "fs";
import path from "path";

type PortainerTemplate = {
  id: number;
  type: number;
  title: string;
  name: string;
  description: string;
  note: string;
  categories: string[];
  platform: string;
  logo: string;
  image: string;
  repository?: {
    url: string;
    stackfile: string;
  };
  env?: Array<{
    name: string;
    label: string;
    description?: string;
    default?: string;
  }>;
  ports?: string[];
  volumes?: Array<{
    container: string;
    bind?: string;
  }>;
  labels?: Array<{
    name: string;
    value: string;
  }>;
  administrator_only: boolean;
};

type App = {
  name: string;
  title: string;
  description: string;
  dockerImage: string;
  version: string;
  youtubeVideo: string;
  docs: string;
  logo: string;
  category: string;
};

const getAppsList = async () => {
  const apps: Record<string, App> = {};
  
  // Get list of app directories in the Apps folder
  const repoRoot = path.join(__dirname, "../..");
  const appsDir = path.join(repoRoot, "Apps");
  
  if (!fs.existsSync(appsDir)) {
    console.warn("Apps directory not found");
    return { apps, count: 0 };
  }
  
  const appDirs = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .filter((dirent) => !dirent.name.startsWith("."))
    .map((dirent) => dirent.name);

  console.log(`Found ${appDirs.length} app directories`);

  for (const appName of appDirs) {
    const templatePath = path.join(appsDir, appName, "template.json");
    
    if (!fs.existsSync(templatePath)) {
      console.warn(`No template.json found for ${appName}, skipping`);
      continue;
    }

    try {
      const templateContent = fs.readFileSync(templatePath, "utf8");
      const templateData: { templates: PortainerTemplate[] } = JSON.parse(templateContent);
      
      if (!templateData.templates || templateData.templates.length === 0) {
        console.warn(`No templates found in ${appName}/template.json`);
        continue;
      }

      const template = templateData.templates[0]; // Get first template
      
      // Extract version from labels
      const versionLabel = template.labels?.find((l) => l.name === "version");
      const version = versionLabel?.value || "latest";
      
      // Extract YouTube and docs from repository stackfile path
      // We'll try to fetch from the original CasaOS repo if available
      let youtubeVideo = "";
      let docs = "";
      
      if (template.repository?.stackfile) {
        const appPath = template.repository.stackfile.split("/")[1]; // e.g., "Apps/jellyseerr/..."
        const casaosAppName = appPath;
        
        try {
          const configUrl = `https://raw.githubusercontent.com/bigbeartechworld/big-bear-casaos/master/Apps/${casaosAppName}/config.json`;
          const configRes = await fetch(configUrl);
          
          if (configRes.ok) {
            const appConfig = await configRes.json();
            youtubeVideo = appConfig.youtube || "";
            docs = appConfig.docs_link || "";
          }
        } catch (e) {
          // Silently fail - not all apps may have config in CasaOS
        }
      }

      apps[appName] = {
        name: template.name,
        title: template.title,
        description: template.description,
        dockerImage: template.image,
        version: version,
        youtubeVideo: youtubeVideo,
        docs: docs,
        logo: template.logo,
        category: template.categories?.[0] || "Uncategorized",
      };
    } catch (e) {
      console.error(`Error parsing template for ${appName}: ${e.message}`);
    }
  }

  return { apps, count: Object.keys(apps).length };
};

const appToMarkdownTable = (apps: Record<string, App>) => {
  let table = `| Application | Docker Image | Version | Category | YouTube Video | Docs |\n`;
  table += `| --- | --- | --- | --- | --- | --- |\n`;

  // Sort apps alphabetically by title
  const sortedApps = Object.values(apps).sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  sortedApps.forEach((app) => {
    const youtubeLink = app.youtubeVideo
      ? `[YouTube Video](${app.youtubeVideo})`
      : "";
    const docsLink = app.docs ? `[Docs](${app.docs})` : "";

    table += `| ${app.title} | ${app.dockerImage} | ${app.version} | ${app.category} | ${youtubeLink} | ${docsLink} |\n`;
  });

  return table;
};

const writeToReadme = (appsTable: string, appCount: number) => {
  const templatePath = path.join(__dirname, "../../templates/README.md");
  const outputPath = path.join(__dirname, "../../README.md");
  
  const baseReadme = fs.readFileSync(templatePath, "utf8");
  let finalReadme = baseReadme.replace("<!appsList>", appsTable);
  finalReadme = finalReadme.replace("<!appCount>", appCount.toString());
  
  fs.writeFileSync(outputPath, finalReadme);
  
  console.log(`✅ README.md generated with ${appCount} apps`);
};

const main = async () => {
  console.log("🚀 Starting Portainer README generation...");
  
  const { apps, count } = await getAppsList();
  
  if (count === 0) {
    console.warn("⚠️  No apps found! README will be empty.");
  }
  
  const markdownTable = appToMarkdownTable(apps);
  writeToReadme(markdownTable, count);
  
  console.log("✨ Done!");
};

main().catch((error) => {
  console.error("❌ Error generating README:", error);
  process.exit(1);
});
