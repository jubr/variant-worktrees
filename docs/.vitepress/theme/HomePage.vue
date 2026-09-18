<template>
  <div class="home-page">
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-badge">
          <span class="version-tag">V0.0.1</span>
          <span class="tech-tags">TypeScript Library / MCP</span>
        </div>
        <h1 class="hero-title">variant-worktrees</h1>
        <p class="hero-tagline">
          Typed database variants for applications and AI clients.
        </p>
        <div class="hero-actions">
          <div class="install-pill">
            <span class="dollar">$</span>
            <span>npm install variant-api</span>
          </div>
          <a class="btn btn-outline" href="/guide/">Read the Guide</a>
          <a class="btn btn-outline" href="/api/">API Reference</a>
        </div>
      </div>
    </section>

    <section class="features">
      <div class="features-inner">
        <div class="features-header">
          <h2 class="features-title">One workflow, two interfaces.</h2>
        </div>
        <div class="features-grid">
          <a class="feature-card" href="/guide/library">
            <span class="feature-tag">LIBRARY</span>
            <h3>TypeScript SDK</h3>
            <p>Create and manage isolated database variants from TypeScript.</p>
            <div class="feature-code">await client.create("preview-one")</div>
          </a>
          <a class="feature-card" href="/mcp">
            <span class="feature-tag">MCP</span>
            <h3>AI Assistant</h3>
            <p>Manage variants from Claude, Cursor, or any MCP client.</p>
            <div class="feature-code">variant-mcp --config variants.yaml</div>
          </a>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 100%;
}

.hero {
  padding: 80px 24px 64px;
  max-width: 960px;
  margin: 0 auto;
}

.hero-inner {
  max-width: 640px;
}

.hero-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.version-tag {
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 12px;
}

.tech-tags,
.hero-tagline {
  color: var(--vp-c-text-2);
}

.tech-tags {
  font-size: 14px;
}

.hero-title {
  font-family: "Space Grotesk", sans-serif;
  font-size: 72px;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
  margin: 0 0 20px;
  background: var(--vp-home-hero-name-background);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-tagline {
  font-size: 18px;
  line-height: 1.6;
  margin: 0 0 40px;
  max-width: 480px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.install-pill,
.feature-code {
  background: var(--vp-c-text-1);
  color: var(--vp-c-bg);
  font-family: "JetBrains Mono", monospace;
}

.install-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: 8px;
  user-select: all;
}

.install-pill .dollar {
  opacity: 0.5;
}

.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.btn-outline {
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.features {
  padding: 0 24px 80px;
  max-width: 960px;
  margin: 0 auto;
}

.features-header {
  margin-bottom: 32px;
}

.features-title {
  font-family: "Space Grotesk", sans-serif;
  font-size: 32px;
  margin: 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  max-width: 960px;
}

.feature-card {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
}

.feature-tag {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--vp-c-brand-1);
}

.feature-card h3 {
  font-family: "Space Grotesk", sans-serif;
  font-size: 20px;
  margin: 4px 0 12px;
}

.feature-card p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0;
  flex: 1;
}

.feature-code {
  margin-top: 20px;
  padding: 10px 14px;
  border-radius: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 48px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
