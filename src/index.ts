import { PluginOption } from "vite";
import * as childProcess from "child_process";


// The plugin
function vitePluginWasmBindgen(): PluginOption {
    return {
        name: "vite-plugin-wasm-bindgen",
        
        async buildStart() {
            this.addWatchFile("crates/wasm");
            await buildWasm();
        },
        
        async handleHotUpdate({file, server}) {
            if (file.includes("crates/wasm") && (file.endsWith(".rs") || file.endsWith(".toml"))) {
                await buildWasm();
                server.ws.send({ type: "full-reload" });
            }
        },
    };
}


// Run the wasm-bindgen tool chain.
async function buildWasm(): Promise<undefined> {
    // What type of build is this?
    const buildType = process.env.NODE_ENV === "production" ? "release" : "debug";
    const cargoReleaseFlag = buildType === "release" ? "--release" : undefined;
    const removeUndefines = (item: string | undefined): item is string => item !== undefined;

    // Build `.wasm` with Cargo
    const cargoArgs = [
        "build",
        "--color", "always",
        cargoReleaseFlag,
        "--package", "wasm",
        "--target", "wasm32-unknown-unknown"
    ].filter(removeUndefines);
    await spawn("cargo", cargoArgs);
    
    // Build supporting javascript with `wasm-bindgen`
    const wasmBindgenKeepDebug = buildType === "debug" ? "--keep-debug" : undefined;
    const wasmBindgenArgs = [
        wasmBindgenKeepDebug,
        "--out-dir", "./crates/wasm",
        "--out-name", "index",
        `./target/wasm32-unknown-unknown/${buildType}/wasm.wasm`
    ].filter(removeUndefines);
    await spawn("wasm-bindgen", wasmBindgenArgs);
}

// Helper to wait until the called program has exited.
function wait(p: childProcess.ChildProcess): Promise<undefined> {
    return new Promise((resolve, reject) => {
        p.on("close", (code) => {
            if (code === 0) {
                resolve(undefined);

            } else {
                reject(new Error("Command `" + p.spawnargs.join(" ") + "` failed with error code: " + code));
            }
        });

        p.on("error", reject);
    });
}

// Helper to run wasm toolchain command.
async function spawn(command: string, args: string[]): Promise<undefined> {
    const p = childProcess.spawn(command, args, { shell: true });
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
    return await wait(p);
}

export default vitePluginWasmBindgen;
