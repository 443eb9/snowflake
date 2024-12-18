import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { convertFileSrc } from "@tauri-apps/api/core";
import { MouseEvent, Suspense, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Euler, Quaternion } from "three";
import { GetRenderCache, GltfPreviewCamera, SaveRenderCache } from "../../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";

export default function ModelReference({ src, asset, onContextMenu }: { src: string, asset: string, onContextMenu: (ev: MouseEvent) => void }) {
    const gltf = useLoader(GLTFLoader, convertFileSrc(src))
    gltf.scene.castShadow = true
    gltf.scene.receiveShadow = true

    const window = getCurrentWindow()

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [changedFlag, setChangedFlag] = useState(false)
    const [camera, setCamera] = useState<GltfPreviewCamera>()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        const unlisten = window.onCloseRequested(async () => {
            if (canvasRef.current && camera) {
                const data = canvasRef.current.toDataURL()
                const base64Data = data.substring("data:image/png;base64,".length)
                await SaveRenderCache({ asset, base64Data, camera })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            }
        })

        return () => {
            async function clean() {
                (await unlisten)()
            }
            clean()
        }
    }, [camera])

    useEffect(() => {
        async function fetch() {
            const cache = await GetRenderCache({ asset })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (cache) {
                setCamera(cache.camera)
            } else {
                setCamera({
                    pos: [0, 0, -10],
                    rot: [0, 0, 0, 1],
                })
            }
        }

        fetch()
    }, [])

    function CameraRetriever() {
        const camera = useThree(st => st.camera)

        useEffect(() => {
            setCamera({
                pos: camera.position.toArray(),
                rot: new Quaternion().setFromEuler(camera.rotation).toArray()
            })
        }, [changedFlag])

        return <></>
    }

    if (!camera) {
        return
    }

    return (
        <Suspense>
            <Canvas
                onContextMenu={onContextMenu}
                camera={{
                    position: camera.pos,
                    rotation: new Euler().setFromQuaternion(
                        new Quaternion(camera.rot[0], camera.rot[1], camera.rot[2], camera.rot[3])
                    )
                }}
                shadows
                onCreated={st => {
                    st.gl.setClearColor("#2b2c2f")
                }}
                ref={canvasRef}
                gl={{ preserveDrawingBuffer: true }}
            >
                <OrbitControls
                    // TODO enable after figure about how to set initial rotation
                    enablePan={false}
                    onChange={() => setChangedFlag(!changedFlag)}
                />
                <ambientLight />
                <primitive object={gltf.scene} />
                <Stats />
                <CameraRetriever />
            </Canvas>
        </Suspense>
    )
}
