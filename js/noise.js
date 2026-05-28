// ================================================================
// SIMPLEX NOISE
// ================================================================
const SimplexNoise = (function() {
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    const F3 = 1/3, G3 = 1/6;
    const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    function mulberry32(a) { return function() { a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296; }; }
    function SimplexNoise(seed) {
        this.p=new Uint8Array(256);this.perm=new Uint8Array(512);this.permMod12=new Uint8Array(512);
        const rng=mulberry32(seed||42);for(let i=0;i<256;i++)this.p[i]=i;for(let i=255;i>0;i--){const j=Math.floor(rng()*(i+1));[this.p[i],this.p[j]]=[this.p[j],this.p[i]];}for(let i=0;i<512;i++){this.perm[i]=this.p[i&255];this.permMod12[i]=this.perm[i]%12;}
    }
    SimplexNoise.prototype.noise2D=function(xin,yin){const s=(xin+yin)*F2;const i=Math.floor(xin+s),j=Math.floor(yin+s);const t=(i+j)*G2;const X0=i-t,Y0=j-t;const x0=xin-X0,y0=yin-Y0;const i1=x0>y0?1:0,j1=x0>y0?0:1;const x1=x0-i1+G2,y1=y0-j1+G2;const x2=x0-1+2*G2,y2=y0-1+2*G2;const ii=i&255,jj=j&255;let n0=0,n1=0,n2=0;let t0=0.5-x0*x0-y0*y0;if(t0>=0){t0*=t0;const gi=this.permMod12[ii+this.perm[jj]];n0=t0*t0*(grad3[gi][0]*x0+grad3[gi][1]*y0);}let t1=0.5-x1*x1-y1*y1;if(t1>=0){t1*=t1;const gi=this.permMod12[ii+i1+this.perm[jj+j1]];n1=t1*t1*(grad3[gi][0]*x1+grad3[gi][1]*y1);}let t2=0.5-x2*x2-y2*y2;if(t2>=0){t2*=t2;const gi=this.permMod12[ii+1+this.perm[jj+1]];n2=t2*t2*(grad3[gi][0]*x2+grad3[gi][1]*y2);}return 70*(n0+n1+n2);};
    SimplexNoise.prototype.noise3D=function(xin,yin,zin){const s=(xin+yin+zin)*F3;const i=Math.floor(xin+s),j=Math.floor(yin+s),k=Math.floor(zin+s);const t=(i+j+k)*G3;const X0=i-t,Y0=j-t,Z0=k-t;const x0=xin-X0,y0=yin-Y0,z0=zin-Z0;let i1,j1,k1,i2,j2,k2;if(x0>=y0){if(y0>=z0){i1=1;j1=0;k1=0;i2=1;j2=1;k2=0;}else if(x0>=z0){i1=1;j1=0;k1=0;i2=1;j2=0;k2=1;}else{i1=0;j1=0;k1=1;i2=1;j2=0;k2=1;}}else{if(y0<z0){i1=0;j1=0;k1=1;i2=0;j2=1;k2=1;}else if(x0<z0){i1=0;j1=1;k1=0;i2=0;j2=1;k2=1;}else{i1=0;j1=1;k1=0;i2=1;j2=1;k2=0;}}const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;const ii=i&255,jj=j&255,kk=k&255;let n0=0,n1=0,n2=0,n3=0;let t0=0.6-x0*x0-y0*y0-z0*z0;if(t0>=0){t0*=t0;const gi=this.permMod12[ii+this.perm[jj+this.perm[kk]]];n0=t0*t0*(grad3[gi][0]*x0+grad3[gi][1]*y0+grad3[gi][2]*z0);}let t1=0.6-x1*x1-y1*y1-z1*z1;if(t1>=0){t1*=t1;const gi=this.permMod12[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]];n1=t1*t1*(grad3[gi][0]*x1+grad3[gi][1]*y1+grad3[gi][2]*z1);}let t2=0.6-x2*x2-y2*y2-z2*z2;if(t2>=0){t2*=t2;const gi=this.permMod12[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]];n2=t2*t2*(grad3[gi][0]*x2+grad3[gi][1]*y2+grad3[gi][2]*z2);}let t3=0.6-x3*x3-y3*y3-z3*z3;if(t3>=0){t3*=t3;const gi=this.permMod12[ii+1+this.perm[jj+1+this.perm[kk+1]]];n3=t3*t3*(grad3[gi][0]*x3+grad3[gi][1]*y3+grad3[gi][2]*z3);}return 32*(n0+n1+n2+n3);};
    return SimplexNoise;
})();
