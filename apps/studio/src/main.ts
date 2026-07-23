import { mountStudio } from "@modyra/studio-ui";
import "@modyra/studio-ui/studio.css";
const host = document.querySelector<HTMLElement>("[data-modyra-studio]");
if (!host) throw new Error("Missing [data-modyra-studio] mount point");
mountStudio(host);
