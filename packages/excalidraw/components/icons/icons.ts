/**
 * The icons the media panel offers, and the ones a diagram can name.
 *
 * An icon is a small drawing that lands on the board as an image, and the
 * very same drawing is what `[icon: ...]` puts in the corner of a diagram
 * node. There is one catalogue for both, so a name that works in the panel
 * works in the code pane and the other way round.
 *
 * The drawings are original geometric glyphs made for Mosaic: a coloured
 * tile with a letter mark, a cloud for the cloud providers and a hexagon
 * for Kubernetes. No vendor artwork is copied — see `ICONS-NOTE.md`.
 *
 * There are enough of them that the catalogue is kept out of the main
 * bundle: the media panel asks for this module only once its icons tab is
 * opened, and the diagram pane only carries it in its own lazy chunk.
 */

import type { TranslationKeys } from "../../i18n";

import type { IconAsset, IconCategoryId } from "./iconDrawing";

export { ICON_SIZE, iconToDataURL, iconToSVG } from "./iconDrawing";

export type { IconAsset, IconCategoryId } from "./iconDrawing";

export type IconCategory = {
  id: IconCategoryId;
  /** the i18n key of the category's name */
  labelKey: TranslationKeys;
  /** other words the category is found by */
  keywords: readonly string[];
};

export const ICON_CATEGORIES: readonly IconCategory[] = [
  {
    id: "tech",
    labelKey: "labels.media.iconCategories.tech",
    keywords: ["language", "framework", "library", "code", "programming"],
  },
  {
    id: "databases",
    labelKey: "labels.media.iconCategories.databases",
    keywords: ["database", "db", "storage", "store", "data"],
  },
  {
    id: "devops",
    labelKey: "labels.media.iconCategories.devops",
    keywords: ["devops", "ci", "cd", "deploy", "build", "infrastructure"],
  },
  {
    id: "aws",
    labelKey: "labels.media.iconCategories.aws",
    keywords: ["amazon", "aws", "cloud", "provider"],
  },
  {
    id: "azure",
    labelKey: "labels.media.iconCategories.azure",
    keywords: ["microsoft", "azure", "cloud", "provider"],
  },
  {
    id: "gcp",
    labelKey: "labels.media.iconCategories.gcp",
    keywords: ["google", "gcp", "cloud", "provider"],
  },
  {
    id: "kubernetes",
    labelKey: "labels.media.iconCategories.kubernetes",
    keywords: ["k8s", "kubernetes", "container", "orchestration"],
  },
];

/**
 * A tile: the ground every glyph is drawn on.
 *
 * The tile is what makes a shelf of icons look like a shelf rather than a
 * pile of drawings — the same shape, at the same size, in a colour that
 * belongs to the thing it stands for.
 */
const tile = (color: string, mark: string) =>
  `<rect x="6" y="6" width="88" height="88" rx="20" fill="${color}"/>${mark}`;

/** a letter mark, white unless the tile is too light to carry it */
const label = (
  text: string,
  options: { size?: number; y?: number; ink?: string } = {},
) => {
  const size =
    options.size ?? (text.length >= 4 ? 22 : text.length === 3 ? 26 : 40);

  return `<text x="50" y="${
    options.y ?? 52
  }" text-anchor="middle" dominant-baseline="central" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="700" letter-spacing="0.5" fill="${
    options.ink ?? "#ffffff"
  }">${text}</text>`;
};

/** a cloud, for the providers that are clouds */
const cloud = (fill: string) =>
  `<g fill="${fill}"><circle cx="34" cy="40" r="13"/><circle cx="54" cy="32" r="17"/><circle cx="72" cy="42" r="11"/><rect x="34" y="38" width="38" height="15" rx="7.5"/></g>`;

/** a provider glyph: a cloud over the service's mark */
const provider = (color: string, code: string) =>
  tile(
    color,
    `${cloud("#ffffff")}${label(code, {
      y: 74,
      size: code.length >= 4 ? 17 : code.length === 3 ? 20 : 24,
    })}`,
  );

/** a hexagon, for the pieces of a cluster */
const hexagon = (stroke: string) =>
  `<path d="M50 12 L82 30 V66 L50 84 L18 66 V30 Z" fill="none" stroke="${stroke}" stroke-width="6" stroke-linejoin="round"/>`;

/** a Kubernetes glyph: a hexagon around the object's mark */
const kube = (color: string, code: string) =>
  tile(
    color,
    `${hexagon("#ffffff")}${label(code, {
      y: 50,
      size: code.length >= 4 ? 15 : code.length === 3 ? 18 : 22,
    })}`,
  );

export const ICONS: readonly IconAsset[] = [
  // ----------------------------------------------------------------- tech
  {
    id: "javascript",
    name: "JavaScript",
    category: "tech",
    keywords: ["js", "language", "web", "frontend"],
    aliases: ["js"],
    body: tile("#f0b429", label("JS", { ink: "#1f2937" })),
  },
  {
    id: "typescript",
    name: "TypeScript",
    category: "tech",
    keywords: ["ts", "language", "web", "typed"],
    aliases: ["ts"],
    body: tile("#2f74c0", label("TS")),
  },
  {
    id: "nodejs",
    name: "Node.js",
    category: "tech",
    keywords: ["node", "runtime", "server", "javascript"],
    aliases: ["node", "node.js"],
    body: tile("#3c873a", label("N")),
  },
  {
    id: "python",
    name: "Python",
    category: "tech",
    keywords: ["language", "scripting", "data", "ml"],
    aliases: ["py"],
    body: tile("#3776ab", label("PY")),
  },
  {
    id: "java",
    name: "Java",
    category: "tech",
    keywords: ["language", "jvm", "backend"],
    body: tile("#b07219", label("J")),
  },
  {
    id: "go",
    name: "Go",
    category: "tech",
    keywords: ["golang", "language", "backend"],
    aliases: ["golang"],
    body: tile("#00add8", label("GO")),
  },
  {
    id: "rust",
    name: "Rust",
    category: "tech",
    keywords: ["language", "systems", "backend"],
    aliases: ["rs"],
    body: tile("#b7410e", label("RS")),
  },
  {
    id: "ruby",
    name: "Ruby",
    category: "tech",
    keywords: ["language", "rails", "backend"],
    aliases: ["rb"],
    body: tile("#cc342d", label("RB")),
  },
  {
    id: "php",
    name: "PHP",
    category: "tech",
    keywords: ["language", "backend", "web"],
    body: tile("#777bb4", label("PHP", { size: 24 })),
  },
  {
    id: "csharp",
    name: "C#",
    category: "tech",
    keywords: ["csharp", "dotnet", "language", "backend"],
    aliases: ["c#", "dotnet", "c-sharp"],
    body: tile("#68217a", label("C#")),
  },
  {
    id: "react",
    name: "React",
    category: "tech",
    keywords: ["frontend", "library", "ui", "javascript"],
    body: tile("#61dafb", label("R", { ink: "#1f2937" })),
  },
  {
    id: "vue",
    name: "Vue",
    category: "tech",
    keywords: ["frontend", "framework", "ui", "javascript"],
    aliases: ["vuejs", "vue.js"],
    body: tile("#41b883", label("V")),
  },
  {
    id: "angular",
    name: "Angular",
    category: "tech",
    keywords: ["frontend", "framework", "ui", "typescript"],
    body: tile("#dd0031", label("A")),
  },
  {
    id: "html",
    name: "HTML",
    category: "tech",
    keywords: ["markup", "web", "frontend"],
    body: tile("#e34f26", label("HTML", { size: 20 })),
  },
  {
    id: "css",
    name: "CSS",
    category: "tech",
    keywords: ["style", "web", "frontend"],
    body: tile("#2965f1", label("CSS")),
  },
  {
    id: "graphql",
    name: "GraphQL",
    category: "tech",
    keywords: ["api", "query", "schema"],
    aliases: ["gql"],
    body: tile("#e10098", label("GQL")),
  },
  {
    id: "git",
    name: "Git",
    category: "tech",
    keywords: ["version control", "scm", "repository", "commit"],
    body: tile("#f05032", label("GIT")),
  },

  // ------------------------------------------------------------ databases
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "databases",
    keywords: ["postgres", "sql", "relational", "database"],
    aliases: ["postgres", "pg", "psql"],
    body: tile("#336791", label("PG")),
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "databases",
    keywords: ["sql", "relational", "database", "mariadb"],
    body: tile("#00758f", label("MY")),
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "databases",
    keywords: ["document", "nosql", "database", "mongo"],
    aliases: ["mongo"],
    body: tile("#13aa52", label("MDB")),
  },
  {
    id: "redis",
    name: "Redis",
    category: "databases",
    keywords: ["cache", "key value", "in memory", "database"],
    aliases: ["cache"],
    body: tile("#dc382d", label("R")),
  },
  {
    id: "sqlite",
    name: "SQLite",
    category: "databases",
    keywords: ["sql", "embedded", "relational", "database"],
    body: tile("#003b57", label("SQL", { size: 22 })),
  },
  {
    id: "cassandra",
    name: "Cassandra",
    category: "databases",
    keywords: ["nosql", "wide column", "distributed", "database"],
    body: tile("#1287b1", label("C")),
  },
  {
    id: "dynamodb",
    name: "DynamoDB",
    category: "databases",
    keywords: ["nosql", "key value", "aws", "database"],
    aliases: ["dynamo"],
    body: tile("#4053d6", label("DDB")),
  },
  {
    id: "elasticsearch",
    name: "Elasticsearch",
    category: "databases",
    keywords: ["search", "index", "lucene", "database"],
    aliases: ["elastic"],
    body: tile("#005571", label("ES")),
  },
  {
    id: "clickhouse",
    name: "ClickHouse",
    category: "databases",
    keywords: ["analytics", "olap", "columnar", "database"],
    body: tile("#ffcc01", label("CH", { ink: "#1f2937" })),
  },
  {
    id: "neo4j",
    name: "Neo4j",
    category: "databases",
    keywords: ["graph", "cypher", "database"],
    body: tile("#008cc1", label("N4J", { size: 22 })),
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "databases",
    keywords: ["warehouse", "analytics", "columnar", "database"],
    body: tile("#29b5e8", label("SF")),
  },

  // --------------------------------------------------------------- devops
  {
    id: "docker",
    name: "Docker",
    category: "devops",
    keywords: ["container", "image", "devops", "ship"],
    aliases: ["container"],
    body: tile("#2496ed", label("D")),
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    category: "devops",
    keywords: ["k8s", "orchestration", "container", "cluster"],
    aliases: ["k8s"],
    body: tile("#326ce5", label("K8S")),
  },
  {
    id: "terraform",
    name: "Terraform",
    category: "devops",
    keywords: ["iac", "infrastructure", "provisioning", "hashicorp"],
    aliases: ["tf", "iac"],
    body: tile("#7b42bc", label("TF")),
  },
  {
    id: "ansible",
    name: "Ansible",
    category: "devops",
    keywords: ["automation", "configuration", "playbook"],
    body: tile("#ee0000", label("A")),
  },
  {
    id: "jenkins",
    name: "Jenkins",
    category: "devops",
    keywords: ["ci", "cd", "pipeline", "build"],
    body: tile("#d33833", label("J")),
  },
  {
    id: "github-actions",
    name: "GitHub Actions",
    category: "devops",
    keywords: ["ci", "cd", "pipeline", "workflow"],
    aliases: ["actions", "gha"],
    body: tile("#24292e", label("GHA")),
  },
  {
    id: "nginx",
    name: "nginx",
    category: "devops",
    keywords: ["web server", "proxy", "reverse proxy", "load balancer"],
    aliases: ["proxy"],
    body: tile("#009639", label("N")),
  },
  {
    id: "prometheus",
    name: "Prometheus",
    category: "devops",
    keywords: ["monitoring", "metrics", "alerting", "observability"],
    aliases: ["metrics"],
    body: tile("#e6522c", label("P")),
  },
  {
    id: "grafana",
    name: "Grafana",
    category: "devops",
    keywords: ["dashboard", "monitoring", "observability", "visualization"],
    aliases: ["dashboard"],
    body: tile("#f46800", label("G")),
  },
  {
    id: "rabbitmq",
    name: "RabbitMQ",
    category: "devops",
    keywords: ["queue", "message broker", "amqp", "messaging"],
    aliases: ["queue", "amqp"],
    body: tile("#ff6600", label("RMQ")),
  },
  {
    id: "kafka",
    name: "Kafka",
    category: "devops",
    keywords: ["streaming", "event bus", "message broker", "messaging"],
    aliases: ["stream", "event bus"],
    body: tile("#231f20", label("K")),
  },
  {
    id: "helm",
    name: "Helm",
    category: "devops",
    keywords: ["charts", "packaging", "kubernetes", "deploy"],
    body: tile("#0f1689", label("H")),
  },

  // ------------------------------------------------------------------ aws
  {
    id: "aws-ec2",
    name: "AWS EC2",
    category: "aws",
    keywords: ["amazon", "compute", "instance", "server", "virtual machine"],
    aliases: ["ec2"],
    body: provider("#ff9900", "EC2"),
  },
  {
    id: "aws-s3",
    name: "AWS S3",
    category: "aws",
    keywords: ["amazon", "storage", "bucket", "object storage"],
    aliases: ["s3"],
    body: provider("#ff9900", "S3"),
  },
  {
    id: "aws-lambda",
    name: "AWS Lambda",
    category: "aws",
    keywords: ["amazon", "serverless", "function", "compute"],
    aliases: ["lambda"],
    body: provider("#ff9900", "FN"),
  },
  {
    id: "aws-rds",
    name: "AWS RDS",
    category: "aws",
    keywords: ["amazon", "database", "sql", "relational"],
    aliases: ["rds"],
    body: provider("#ff9900", "RDS"),
  },
  {
    id: "aws-dynamodb",
    name: "AWS DynamoDB",
    category: "aws",
    keywords: ["amazon", "database", "nosql", "key value"],
    aliases: ["aws-dynamo"],
    body: provider("#ff9900", "DDB"),
  },
  {
    id: "aws-sqs",
    name: "AWS SQS",
    category: "aws",
    keywords: ["amazon", "queue", "messaging", "async"],
    aliases: ["sqs"],
    body: provider("#ff9900", "SQS"),
  },
  {
    id: "aws-sns",
    name: "AWS SNS",
    category: "aws",
    keywords: ["amazon", "notification", "pubsub", "messaging"],
    aliases: ["sns"],
    body: provider("#ff9900", "SNS"),
  },
  {
    id: "aws-api-gateway",
    name: "AWS API Gateway",
    category: "aws",
    keywords: ["amazon", "api", "http", "rest"],
    aliases: ["api-gateway"],
    body: provider("#ff9900", "API"),
  },
  {
    id: "aws-cloudfront",
    name: "AWS CloudFront",
    category: "aws",
    keywords: ["amazon", "cdn", "edge", "cache"],
    aliases: ["cloudfront", "cdn"],
    body: provider("#ff9900", "CF"),
  },
  {
    id: "aws-iam",
    name: "AWS IAM",
    category: "aws",
    keywords: ["amazon", "identity", "access", "permissions", "security"],
    aliases: ["iam"],
    body: provider("#ff9900", "IAM"),
  },

  // ---------------------------------------------------------------- azure
  {
    id: "azure-vm",
    name: "Azure Virtual Machines",
    category: "azure",
    keywords: ["microsoft", "compute", "instance", "server"],
    aliases: ["azure-vm", "vm"],
    body: provider("#0078d4", "VM"),
  },
  {
    id: "azure-blob",
    name: "Azure Blob Storage",
    category: "azure",
    keywords: ["microsoft", "storage", "object storage", "container"],
    aliases: ["blob"],
    body: provider("#0078d4", "BLB"),
  },
  {
    id: "azure-functions",
    name: "Azure Functions",
    category: "azure",
    keywords: ["microsoft", "serverless", "function", "compute"],
    aliases: ["functions"],
    body: provider("#0078d4", "FN"),
  },
  {
    id: "azure-sql",
    name: "Azure SQL",
    category: "azure",
    keywords: ["microsoft", "database", "relational", "sql"],
    aliases: ["azure-sql-database"],
    body: provider("#0078d4", "SQL"),
  },
  {
    id: "azure-aks",
    name: "Azure AKS",
    category: "azure",
    keywords: ["microsoft", "kubernetes", "container", "orchestration"],
    aliases: ["aks"],
    body: provider("#0078d4", "AKS"),
  },
  {
    id: "azure-cosmos-db",
    name: "Azure Cosmos DB",
    category: "azure",
    keywords: ["microsoft", "database", "nosql", "distributed"],
    aliases: ["cosmos", "cosmosdb"],
    body: provider("#0078d4", "CDB"),
  },
  {
    id: "azure-service-bus",
    name: "Azure Service Bus",
    category: "azure",
    keywords: ["microsoft", "queue", "messaging", "pubsub"],
    aliases: ["service-bus"],
    body: provider("#0078d4", "SB"),
  },
  {
    id: "azure-monitor",
    name: "Azure Monitor",
    category: "azure",
    keywords: ["microsoft", "monitoring", "metrics", "observability"],
    aliases: ["azure-monitoring"],
    body: provider("#0078d4", "MON"),
  },

  // ------------------------------------------------------------------ gcp
  {
    id: "gcp-compute-engine",
    name: "GCP Compute Engine",
    category: "gcp",
    keywords: ["google", "compute", "instance", "server", "virtual machine"],
    aliases: ["compute-engine", "gce"],
    body: provider("#4285f4", "GCE"),
  },
  {
    id: "gcp-cloud-storage",
    name: "GCP Cloud Storage",
    category: "gcp",
    keywords: ["google", "storage", "bucket", "object storage"],
    aliases: ["cloud-storage", "gcs"],
    body: provider("#4285f4", "GCS"),
  },
  {
    id: "gcp-cloud-functions",
    name: "GCP Cloud Functions",
    category: "gcp",
    keywords: ["google", "serverless", "function", "compute"],
    aliases: ["cloud-functions", "gcf"],
    body: provider("#4285f4", "GCF"),
  },
  {
    id: "gcp-cloud-sql",
    name: "GCP Cloud SQL",
    category: "gcp",
    keywords: ["google", "database", "relational", "sql"],
    aliases: ["cloud-sql"],
    body: provider("#4285f4", "SQL"),
  },
  {
    id: "gcp-gke",
    name: "GCP GKE",
    category: "gcp",
    keywords: ["google", "kubernetes", "container", "orchestration"],
    aliases: ["gke"],
    body: provider("#4285f4", "GKE"),
  },
  {
    id: "gcp-bigquery",
    name: "GCP BigQuery",
    category: "gcp",
    keywords: ["google", "analytics", "warehouse", "database"],
    aliases: ["bigquery", "bq"],
    body: provider("#4285f4", "BQ"),
  },
  {
    id: "gcp-pubsub",
    name: "GCP Pub/Sub",
    category: "gcp",
    keywords: ["google", "queue", "messaging", "event"],
    aliases: ["pubsub", "pub-sub"],
    body: provider("#4285f4", "PS"),
  },
  {
    id: "gcp-cloud-run",
    name: "GCP Cloud Run",
    category: "gcp",
    keywords: ["google", "container", "serverless", "deploy"],
    aliases: ["cloud-run"],
    body: provider("#4285f4", "RUN"),
  },

  // ----------------------------------------------------------- kubernetes
  {
    id: "k8s-pod",
    name: "Kubernetes Pod",
    category: "kubernetes",
    keywords: ["k8s", "container", "workload", "cluster"],
    aliases: ["pod"],
    body: kube("#326ce5", "POD"),
  },
  {
    id: "k8s-deployment",
    name: "Kubernetes Deployment",
    category: "kubernetes",
    keywords: ["k8s", "workload", "replicas", "rollout"],
    aliases: ["deployment"],
    body: kube("#326ce5", "DEP"),
  },
  {
    id: "k8s-service",
    name: "Kubernetes Service",
    category: "kubernetes",
    keywords: ["k8s", "networking", "load balancer", "endpoint"],
    aliases: ["service", "svc"],
    body: kube("#326ce5", "SVC"),
  },
  {
    id: "k8s-ingress",
    name: "Kubernetes Ingress",
    category: "kubernetes",
    keywords: ["k8s", "networking", "route", "http"],
    aliases: ["ingress"],
    body: kube("#326ce5", "ING"),
  },
  {
    id: "k8s-configmap",
    name: "Kubernetes ConfigMap",
    category: "kubernetes",
    keywords: ["k8s", "configuration", "settings", "env"],
    aliases: ["configmap", "config-map"],
    body: kube("#326ce5", "CM"),
  },
  {
    id: "k8s-secret",
    name: "Kubernetes Secret",
    category: "kubernetes",
    keywords: ["k8s", "credentials", "security", "env"],
    aliases: ["secret"],
    body: kube("#326ce5", "SEC"),
  },
  {
    id: "k8s-node",
    name: "Kubernetes Node",
    category: "kubernetes",
    keywords: ["k8s", "worker", "machine", "cluster"],
    aliases: ["k8s-node"],
    body: kube("#326ce5", "NODE"),
  },
  {
    id: "k8s-statefulset",
    name: "Kubernetes StatefulSet",
    category: "kubernetes",
    keywords: ["k8s", "workload", "stateful", "storage"],
    aliases: ["statefulset", "stateful-set"],
    body: kube("#326ce5", "STS"),
  },
];

export const getIconById = (id: string) => ICONS.find((icon) => icon.id === id);

/** the icon with an exact id — the lookup a diagram's file id is built on */
export const findIconById = (id: string): IconAsset | null =>
  ICONS.find((icon) => icon.id === id) ?? null;

/**
 * The icon a diagram's `[icon: ...]` names, or null when it names none.
 *
 * A name answers to the icon's id, to the other names it is filed under and
 * to its display name — so `postgres`, `postgresql` and `PostgreSQL` are the
 * same icon, which is what makes a name copied from the panel work in code.
 */
export const findIconByName = (name: string | undefined): IconAsset | null => {
  if (!name) {
    return null;
  }

  const needle = name.trim().toLowerCase();

  if (!needle) {
    return null;
  }

  return (
    ICONS.find(
      (icon) =>
        icon.id === needle ||
        icon.name.toLowerCase() === needle ||
        icon.aliases?.some((alias) => alias.toLowerCase() === needle),
    ) ?? null
  );
};

/** a category and the icons of it that matched a search */
export type IconGroup = {
  category: IconCategory;
  icons: IconAsset[];
};

/**
 * Whether a word answers to what the user is looking for.
 *
 * The match goes both ways for a single word, so that "sql" finds "MySQL"
 * and "mysql" finds it as well. A search of several words is only matched
 * the plain way round — the other way round would let a word inside the
 * search match on its own.
 */
const contains = (haystack: string, needle: string) => {
  if (haystack.includes(needle)) {
    return true;
  }

  if (needle.includes(" ") || haystack.length < 3) {
    return false;
  }

  return needle.includes(haystack);
};

/**
 * Whether an icon answers to what the user is looking for.
 *
 * An icon answers to its own name, to the other names it is filed under and
 * to the name of its category — typing "database" finds the databases,
 * typing "k8s" finds the cluster pieces.
 */
const matches = (icon: IconAsset, needle: string) => {
  if (contains(icon.name.toLowerCase(), needle)) {
    return true;
  }

  if (icon.aliases?.some((alias) => contains(alias.toLowerCase(), needle))) {
    return true;
  }

  if (icon.keywords?.some((keyword) => contains(keyword, needle))) {
    return true;
  }

  const category = ICON_CATEGORIES.find((entry) => entry.id === icon.category);

  if (!category) {
    return false;
  }

  return (
    contains(category.id, needle) ||
    category.keywords.some((keyword) => contains(keyword, needle))
  );
};

/**
 * The icons matching a search, grouped by the category they belong to.
 *
 * An empty search returns every category in full. A category can be named,
 * in which case only that category is looked at; without one, the search is
 * looked at across every category. Categories that end up with nothing in
 * them are dropped, so the panel never shows an empty heading.
 */
export const searchIcons = (
  query: string,
  category?: IconCategoryId,
): IconGroup[] => {
  const needle = query.trim().toLowerCase();

  const categories = category
    ? ICON_CATEGORIES.filter((entry) => entry.id === category)
    : ICON_CATEGORIES;

  return categories.reduce<IconGroup[]>((groups, entry) => {
    const icons = ICONS.filter(
      (icon) =>
        icon.category === entry.id && (!needle || matches(icon, needle)),
    );

    if (icons.length) {
      groups.push({ category: entry, icons });
    }

    return groups;
  }, []);
};

/** how many icons the panel offers in total */
export const getIconCount = () => ICONS.length;
