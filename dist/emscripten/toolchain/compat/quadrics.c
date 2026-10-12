#include <GL/gl.h>
#include <GL/glu.h>
#include <stdlib.h>
#include <math.h>
#include <emscripten.h>
/* GLU quadrics use the same tessellation model as the established GL Lab API,
 * but every vertex and normal now goes through native GL4ES. */
struct GLUquadric { GLenum style,normals,orientation; GLboolean texture; };
GLUquadric *gluNewQuadric(void) {
  GLUquadric *q=malloc(sizeof(*q));if(q)*q=(GLUquadric){GLU_FILL,GLU_SMOOTH,GLU_OUTSIDE,GL_FALSE};return q;
}
void gluDeleteQuadric(GLUquadric *q){free(q);}
void gluQuadricDrawStyle(GLUquadric *q,GLenum v){
  if(v!=GLU_POINT&&v!=GLU_LINE&&v!=GLU_FILL) { EM_ASM({throw new Error('GLU_SILHOUETTE quadrics are unsupported; use GLU_LINE, GLU_POINT or GLU_FILL.');});return; }
  if(q)q->style=v;
}
void gluQuadricNormals(GLUquadric *q,GLenum v){
  if(v!=GLU_SMOOTH&&v!=GLU_FLAT&&v!=GLU_NONE){EM_ASM({throw new Error('Invalid quadric normal mode.');});return;}
  if(q)q->normals=v;
}
void gluQuadricOrientation(GLUquadric *q,GLenum v){
  if(v!=GLU_OUTSIDE&&v!=GLU_INSIDE){EM_ASM({throw new Error('Invalid quadric orientation.');});return;}
  if(q)q->orientation=v;
}
void gluQuadricTexture(GLUquadric *q,GLboolean v){if(q)q->texture=v;}
typedef struct {GLdouble x,y,z,nx,ny,nz;} Vertex;
typedef Vertex (*Surface)(GLdouble,GLdouble,const GLdouble *);
static void emit(GLUquadric *q,Surface surface,GLdouble u,GLdouble v,const GLdouble *args){
  Vertex p=surface(u,v,args);GLdouble sign=q->orientation==GLU_INSIDE?-1:1;
  if(q->normals==GLU_SMOOTH||(q->normals==GLU_FLAT&&q->style!=GLU_FILL))glNormal3d(sign*p.nx,sign*p.ny,sign*p.nz);
  if(q->texture)glTexCoord2d(u,v);glVertex3d(p.x,p.y,p.z);
}
static void mesh(GLUquadric *q,int slices,int stacks,Surface surface,const GLdouble *args){
  if(!q||slices<2||stacks<1)return;
  if(q->style==GLU_POINT){glBegin(GL_POINTS);for(int j=0;j<=stacks;j++)for(int i=0;i<=slices;i++)emit(q,surface,(double)i/slices,(double)j/stacks,args);glEnd();return;}
  if(q->style==GLU_LINE){
    for(int j=0;j<=stacks;j++){glBegin(GL_LINE_STRIP);for(int i=0;i<=slices;i++)emit(q,surface,(double)i/slices,(double)j/stacks,args);glEnd();}
    for(int i=0;i<slices;i++){glBegin(GL_LINE_STRIP);for(int j=0;j<=stacks;j++)emit(q,surface,(double)i/slices,(double)j/stacks,args);glEnd();}return;
  }
  glBegin(GL_QUADS);
  for(int j=0;j<stacks;j++)for(int i=0;i<slices;i++){
    GLdouble u0=(double)i/slices,u1=(double)(i+1)/slices,v0=(double)j/stacks,v1=(double)(j+1)/stacks;
    if(q->normals==GLU_FLAT){
      Vertex a=surface(u0,v0,args),b=surface(u1,v0,args),c=surface(u1,v1,args);
      GLdouble bx=b.x-a.x,by=b.y-a.y,bz=b.z-a.z,cx=c.x-a.x,cy=c.y-a.y,cz=c.z-a.z;
      GLdouble nx=by*cz-bz*cy,ny=bz*cx-bx*cz,nz=bx*cy-by*cx,d=sqrt(nx*nx+ny*ny+nz*nz);
      if(!d){a=surface(u0,v1,args);bx=b.x-a.x;by=b.y-a.y;bz=b.z-a.z;cx=c.x-a.x;cy=c.y-a.y;cz=c.z-a.z;nx=by*cz-bz*cy;ny=bz*cx-bx*cz;nz=bx*cy-by*cx;d=sqrt(nx*nx+ny*ny+nz*nz);}
      GLdouble sign=q->orientation==GLU_INSIDE?-1:1;if(d)glNormal3d(sign*nx/d,sign*ny/d,sign*nz/d);
    }
    emit(q,surface,u0,v0,args);
    if(q->orientation==GLU_INSIDE){emit(q,surface,u0,v1,args);emit(q,surface,u1,v1,args);emit(q,surface,u1,v0,args);}
    else {emit(q,surface,u1,v0,args);emit(q,surface,u1,v1,args);emit(q,surface,u0,v1,args);}
  }
  glEnd();
}
static Vertex sphere(GLdouble u,GLdouble v,const GLdouble *a){
  GLdouble angle=u*2*M_PI,phi=(1-v)*M_PI,x=sin(phi)*cos(angle),y=sin(phi)*sin(angle),z=cos(phi);
  return (Vertex){a[0]*x,a[0]*y,a[0]*z,x,y,z};
}
static Vertex cylinder(GLdouble u,GLdouble v,const GLdouble *a){
  GLdouble angle=u*2*M_PI,r=a[0]+(a[1]-a[0])*v,d=hypot(a[2],a[0]-a[1]);
  return (Vertex){r*cos(angle),r*sin(angle),a[2]*v,a[2]*cos(angle)/d,a[2]*sin(angle)/d,(a[0]-a[1])/d};
}
static Vertex disk(GLdouble u,GLdouble v,const GLdouble *a){
  GLdouble angle=(a[2]+u*a[3])*M_PI/180,r=a[0]+(a[1]-a[0])*v;
  return (Vertex){r*sin(angle),r*cos(angle),0,0,0,1};
}
void gluSphere(GLUquadric *q,GLdouble radius,GLint slices,GLint stacks){if(radius<0)return;GLdouble args[]={radius};mesh(q,slices,stacks,sphere,args);}
void gluCylinder(GLUquadric *q,GLdouble base,GLdouble top,GLdouble height,GLint slices,GLint stacks){
  if(base<0||top<0||height<=0)return;GLdouble args[]={base,top,height};mesh(q,slices,stacks,cylinder,args);
}
void gluPartialDisk(GLUquadric *q,GLdouble inner,GLdouble outer,GLint slices,GLint loops,GLdouble start,GLdouble sweep){
  if(inner<0||outer<=inner||sweep==0)return;if(sweep>360)sweep=360;if(sweep<-360)sweep=-360;
  GLdouble args[]={inner,outer,start,sweep};mesh(q,slices,loops,disk,args);
}
void gluDisk(GLUquadric *q,GLdouble inner,GLdouble outer,GLint slices,GLint loops){gluPartialDisk(q,inner,outer,slices,loops,0,360);}
