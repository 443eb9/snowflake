import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Suspense, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Camera, WebGLRenderer } from "three";
import { SaveRenderResult } from "../../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";

export default function ModelReference({ src, asset }: { src: string, asset: string }) {
    const gltf = useLoader(GLTFLoader, convertFileSrc(src))
    gltf.scene.castShadow = true
    gltf.scene.receiveShadow = true

    const window = getCurrentWindow()

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [changedFlag, setChangedFlag] = useState(false)
    const [camera, setCamera] = useState<Camera>()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        const unlisten = window.onCloseRequested(async () => {
            if (canvasRef.current) {
                const data = canvasRef.current.toDataURL()
                const base64Data = data.substring("data:image/png;base64,".length)
                await SaveRenderResult({ asset, base64Data })
                    .catch(err => dispatchToast(<ErrToast body={err} />))
            }
        })

        return () => {
            async function clean() {
                (await unlisten)()
            }
            clean()
        }
    }, [])

    function CameraRetriever() {
        const camera = useThree(st => st.camera)

        useEffect(() => {
            setCamera(camera)
        }, [changedFlag])

        return <></>
    }

    return (
        <Suspense>
            <Canvas
                // TODO use computed position or stored position
                camera={{ position: [0, 0, -10] }}
                shadows
                onCreated={st => {
                    st.gl.setClearColor("#2b2c2f")
                    // st.gl.autoClear = false
                }}
                ref={canvasRef}
                gl={{ preserveDrawingBuffer: true }}
            >
                <OrbitControls onChange={() => setChangedFlag(!changedFlag)} />
                <directionalLight castShadow />
                <primitive object={gltf.scene} />
                <axesHelper />
                <Stats />
                <CameraRetriever />
            </Canvas>
        </Suspense>
    )
}
