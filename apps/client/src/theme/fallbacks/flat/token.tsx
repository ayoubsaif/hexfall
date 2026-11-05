// Number-token base: a thin chip resting on the tile. The board view draws the number.
import { FlatShape } from "../../flat.tsx";

export const TOKEN_COLOR = "#f1e6c8";

export const TokenPiece = () => <FlatShape assetKey="token" color={TOKEN_COLOR} />;
