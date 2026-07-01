interface AppConfig {
    BASE_URL: string
    APP_NAME: string
    APP_DESCRIPTION: string
    APP_DEFAULT_LANG: string
}

export default <AppConfig>{
    BASE_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    APP_NAME: "IntraNet",
    APP_DESCRIPTION: "A IntraNet é uma aplicação de gestão interna que ajuda a organizar e priorizar o trabalho com eficiência.",
    APP_DEFAULT_LANG: "pt",
}
