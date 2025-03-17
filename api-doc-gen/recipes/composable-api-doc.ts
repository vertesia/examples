import { copy, vars } from "@vertesia/memory-commands";

const { studio } = vars();
if (!studio) {
    throw new Error('Studio path not specified. Use --var-studio to specify the path to studio repository');
}
console.log("Using studio root at", studio);

copy(`${studio}/apps/studio-server/src/api/**.ts`, `${studio}/apps/studio-server/src/api!api/studio/*`);
copy(`${studio}/apps/zeno-server/src/api/**.ts`, `${studio}/apps/zeno-server/src/api!api/zeno/*`);
copy(`${studio}/composableai/packages/client/src/**/*.ts`, `${studio}/composableai/packages/client/src!client/*`);
copy(`${studio}/composableai/packages/common/src/**/*.ts`, `${studio}/composableai/packages/common/src!types/*`);
copy(`${studio}/apps/docs/src/app/**/*.mdx`, `${studio}/apps/docs/src/app!examples/%p`);

// no metadata is required
export default {}
