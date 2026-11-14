import { NdaCreatorLoader } from "@/components/NdaCreatorLoader";
import { loadNdaTemplate } from "@/lib/nda/load-template";

export default function Home() {
  return <NdaCreatorLoader template={loadNdaTemplate()} />;
}
