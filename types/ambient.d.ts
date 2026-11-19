declare module "sigma" {
  const Sigma: any;
  export default Sigma;
}

declare module "graphology" {
  const Graph: any;
  export default Graph;
}

declare module "graphology-layout-forceatlas2" {
  const forceAtlas2: any;
  export default forceAtlas2;
}

declare module "graphology-layout" {
  const layout: any;
  export default layout;
}

// Global stylesheet side-effect imports (e.g. app/layout.tsx `import "./globals.css"`).
// Required since TS 6.0 defaults `noUncheckedSideEffectImports` to true; harmless on TS 5.x.
declare module "*.css";
