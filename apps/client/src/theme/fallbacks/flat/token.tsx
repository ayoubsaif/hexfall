// Number-token base: a flat disc on the marker layer. The board view draws the number.
import { FlatShape } from "../../flat.tsx";

export const TOKEN_COLOR = "#f1e6c8";

export const TokenPiece = () => <FlatShape assetKey="token" color={TOKEN_COLOR} />;
