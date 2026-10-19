{
  description = "Armonía del Ser: Admin Dashboard (armonia-dashboard) — Node.js 22 + pnpm + Biome devShell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          name = "armonia-dashboard-dev-shell";
          packages = with pkgs; [
            nodejs_22
            pnpm
            biome
            tea
          ];
        };
      });
}
