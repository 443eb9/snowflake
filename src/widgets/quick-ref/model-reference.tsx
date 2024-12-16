import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Canvas, useLoader, useThree } from "@react-three/fiber";
import { OrbitControls, Stats } from "@react-three/drei";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Suspense, useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Camera } from "three";

export default function ModelReference({ src }: { src: string }) {
    const gltf = useLoader(GLTFLoader, convertFileSrc(src))
    gltf.scene.castShadow = true
    gltf.scene.receiveShadow = true

    const window = getCurrentWindow()

    const [changedFlag, setChangedFlag] = useState(false)
    const [camera, setCamera] = useState<Camera>()

    useEffect(() => {
        const unlisten = window.onCloseRequested(() => {
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
                camera={{
                    position: [0, 0, -10],
                    onUpdate: ev => {
                        console.log(ev)
                    }
                }}
                shadows
                onCreated={st => st.gl.setClearColor("#2b2c2f")}
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
