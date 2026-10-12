const app = document.querySelector("#app");

// Goes through the dev server's /api proxy to the `be` instance.
fetch("/api")
  .then((response) => response.text())
  .then((text) => {
    if (app) {
      app.textContent = `example-fe → ${text}`;
    }
  })
  .catch(() => {
    if (app) {
      app.textContent = "example-fe (be not reachable)";
    }
  });
