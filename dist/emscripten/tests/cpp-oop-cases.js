// Same source/expected/pixel contract as merged-cases.js. Every assertion runs
// inside a real compiled C++17 program, through the editor's Compiler/Runner.
export const cppOopCases = [
  {name:'C++ OOP classes, access, multiple inheritance and virtual destruction',language:'cpp',expected:'oop=42;destroyed=1;alive=0',source:`#include <cassert>
#include <cstdio>
#include <type_traits>
namespace game {
class Counter {
  int value_;
protected:
  int value() const { return value_; }
public:
  static int alive;
  explicit Counter(int v): value_(v) { ++alive; }
  virtual ~Counter() { --alive; }
  friend int inspect(const Counter& c) { return c.value_; }
};
int Counter::alive=0;
struct Entity { virtual int score() const=0; virtual ~Entity()=default; };
struct Drawable { virtual int draw() const=0; virtual ~Drawable()=default; };
class Snake final: public Counter, public Entity, public Drawable {
public:
  static int destroyed;
  explicit Snake(int v): Counter(v) {}
  ~Snake() override { ++destroyed; }
  int score() const override { return value(); }
  int draw() const override { return score()+2; }
};
int Snake::destroyed=0;
struct Point {
  int x,y;
  Point operator+(const Point& rhs) const { return {x+rhs.x,y+rhs.y}; }
  friend bool operator==(const Point& a,const Point& b) { return a.x==b.x && a.y==b.y; }
};
int throughReference(const Entity& e) { return e.score(); }
}
int main() {
  using namespace game;
  static_assert(std::is_abstract_v<Entity> && std::has_virtual_destructor_v<Entity>);
  static_assert(!std::is_convertible_v<Snake*,int*>);
  Entity* e=new Snake(40); Drawable* d=dynamic_cast<Drawable*>(e);
  assert(Counter::alive==1 && e->score()==40 && throughReference(*e)==40);
  assert(d && d->draw()==42 && inspect(*dynamic_cast<Snake*>(e))==40);
  Point p=Point{1,2}+Point{3,4}; assert((p==Point{4,6}));
  delete e;
  assert(Snake::destroyed==1 && Counter::alive==0);
  std::printf("oop=42;destroyed=%d;alive=%d\\n",Snake::destroyed,Counter::alive);
}`},
  {name:'C++ OOP RTTI dynamic_cast and typeid',language:'cpp',expected:'rtti=down,reference,cross,null,typeid,bad_cast,bad_typeid',source:`#include <cassert>
#include <cstdio>
#include <typeinfo>
struct Base { virtual ~Base()=default; };
struct Interface { virtual int id() const=0; virtual ~Interface()=default; };
struct Derived: Base, Interface { int id() const override { return 42; } };
struct Other: Base {};
int main() {
  Derived d; Base* b=&d; Base& ref=d;
  assert(dynamic_cast<Derived*>(b)==&d && &dynamic_cast<Derived&>(ref)==&d);
  assert(dynamic_cast<Interface*>(b)->id()==42 && !dynamic_cast<Other*>(b));
  assert(typeid(*b)==typeid(Derived) && typeid(*b)!=typeid(Base));
  int caught=0;
  try { (void)dynamic_cast<Other&>(ref); } catch(const std::bad_cast&) { ++caught; }
  try { Base* empty=nullptr; (void)typeid(*empty); } catch(const std::bad_typeid&) { ++caught; }
  assert(caught==2);
  std::puts("rtti=down,reference,cross,null,typeid,bad_cast,bad_typeid");
}`},
  {name:'C++ OOP templates, specialization and C++17 vocabulary',language:'cpp',expected:'templates=42;optional=7;variant=snake;inline=9',source:`#include <cassert>
#include <cstdio>
#include <optional>
#include <variant>
#include <string>
#include <type_traits>
#include <utility>
template<class T> struct Box { T value; T get() const { return value; } };
template<> struct Box<const char*> { std::string value; int get() const { return value.size(); } };
template<class T> T twice(T v) { return v+v; }
template<> int twice<int>(int v) { return 2*v; }
template<class... T> constexpr auto sum(T... values) { return (values+...); }
template<class T> int measure(const T& v) {
  if constexpr(std::is_integral_v<T>) return v;
  else return v.size();
}
namespace config { inline int speed=9; }
struct Settings { inline static int limit=42; };
int main() {
  auto [x,y]=std::pair<int,int>{10,11};
  Box<int> b{twice(x+y)}; Box<const char*> text{"snake"};
  static_assert(sum(1,2,3)==6); assert(b.get()==42 && text.get()==5);
  assert(measure(7)==7 && measure(std::string("abc"))==3 && Settings::limit==42);
  std::optional<int> value=7; assert(value.value()==7 && std::optional<int>{}.value_or(8)==8);
  std::variant<int,std::string> v=std::string("snake");
  assert(std::get_if<int>(&v)==nullptr && std::holds_alternative<std::string>(v));
  assert(std::visit([](const auto& item){return measure(item);},v)==5);
  std::printf("templates=%d;optional=%d;variant=%s;inline=%d\\n",b.get(),*value,std::get<std::string>(v).c_str(),config::speed);
}`},
  {name:'C++ OOP smart pointers, moves, lambdas and std::function',language:'cpp',expected:'ownership=expired;moves=1;function=42;destroyed=3',source:`#include <cassert>
#include <cstdio>
#include <memory>
#include <functional>
#include <utility>
struct Entity { static int destroyed; virtual ~Entity(){++destroyed;} virtual int score()const=0; };
int Entity::destroyed=0;
struct Snake: Entity { int score()const override{return 40;} };
struct Movable {
  inline static int moves=0;
  std::unique_ptr<int> data;
  explicit Movable(int v):data(std::make_unique<int>(v)){}
  Movable(const Movable&)=delete;
  Movable(Movable&& other) noexcept:data(std::move(other.data)){++moves;}
};
int main(){
  { std::unique_ptr<Entity> a=std::make_unique<Snake>(); auto b=std::move(a); assert(!a && b->score()==40); }
  std::weak_ptr<Entity> weak;
  { auto shared=std::make_shared<Snake>(); weak=shared; std::shared_ptr<Entity> copy=shared;
    assert(copy.use_count()==2 && weak.lock()->score()==40); copy.reset(); assert(shared.use_count()==1); }
  assert(weak.expired() && !weak.lock());
  { auto raw=std::make_unique<Snake>(); raw.reset(); }
  Movable a(40); Movable b(std::move(a)); assert(!a.data && *b.data==40 && Movable::moves==1);
  int delta=2; std::function<int(int)> add=[delta](int v){return v+delta;};
  auto owned=[p=std::make_unique<int>(42)](){return *p;};
  int (*plain)(int)=[](int v){return v*2;};
  assert(owned()==42 && plain(21)==42 && add(*b.data)==42 && Entity::destroyed==3);
  std::printf("ownership=expired;moves=%d;function=%d;destroyed=%d\\n",Movable::moves,add(*b.data),Entity::destroyed);
}`},
  {name:'C++ OOP game containers, algorithms and random',language:'cpp',expected:'containers=vector,deque,list,map,unordered_map,set,array;random=ok',source:`#include <cassert>
#include <cstdio>
#include <vector>
#include <deque>
#include <list>
#include <map>
#include <unordered_map>
#include <set>
#include <array>
#include <algorithm>
#include <numeric>
#include <random>
#include <string>
struct Cell { int x,y; };
int main(){
  std::vector<int> v{3,1,2}; std::sort(v.begin(),v.end()); assert((v==std::vector<int>{1,2,3}));
  auto found=std::find_if(v.begin(),v.end(),[](int x){return x>1;}); assert(found!=v.end() && *found==2);
  std::deque<Cell> snake{{1,2},{2,2}}; snake.push_front({0,2}); snake.pop_back(); assert(snake.size()==2 && snake.front().x==0);
  std::list<int> path{3,1,2}; path.sort(); path.remove(2); assert(path.front()==1 && path.back()==3);
  std::map<std::string,int> scores{{"snake",42}}; std::unordered_map<int,Cell> cells{{7,{3,4}}};
  assert(scores.at("snake")==42 && cells.at(7).y==4);
  std::set<int> occupied{1,2,2,3}; assert(occupied.size()==3 && occupied.count(2)==1);
  std::array<int,3> a{1,2,3}; assert(std::accumulate(a.begin(),a.end(),0)==6);
  std::mt19937 rng(123),same(123); assert(rng()==same());
  std::uniform_int_distribution<int> pick(0,9); for(int i=0;i<100;++i){int n=pick(rng);assert(n>=0 && n<=9);}
  std::shuffle(v.begin(),v.end(),rng); std::sort(v.begin(),v.end()); assert(v.front()==1 && v.back()==3);
  std::puts("containers=vector,deque,list,map,unordered_map,set,array;random=ok");
}`},
  {name:'C++ OOP exceptions unwind, rethrow and standard library throws',language:'cpp',expected:'exceptions=7;unwound=2;rethrow=ok',source:`#include <cassert>
#include <cstdio>
#include <stdexcept>
#include <exception>
#include <string>
#include <vector>
#include <optional>
#include <variant>
struct Guard { int& count; ~Guard(){++count;} };
struct GameError: std::runtime_error { GameError():std::runtime_error("game-over"){} };
void fail(int& n){ Guard g{n}; throw GameError(); }
int main(){
  int count=0,unwound=0;
  try { Guard outer{unwound}; try {fail(unwound);} catch(const GameError&){++count;throw;} }
  catch(const std::exception& e){assert(std::string(e.what())=="game-over");++count;}
  assert(unwound==2);
  try { throw 42; } catch(int n){assert(n==42);++count;}
  try { std::vector<int>{1}.at(5); } catch(const std::out_of_range&){++count;}
  try { std::optional<int>{}.value(); } catch(const std::bad_optional_access&){++count;}
  try { std::variant<int,float> v=1; (void)std::get<float>(v); } catch(const std::bad_variant_access&){++count;}
  try { throw GameError(); } catch(...){assert(std::current_exception());++count;}
  assert(count==7 && std::uncaught_exceptions()==0);
  std::printf("exceptions=%d;unwound=%d;rethrow=ok\\n",count,unwound);
}`},
  {name:'C++ OOP global and local static constructors and normal exit destructors',language:'cpp',expected:'global+|static+|local+|main|local-|static-|global-|',source:`#include <cstdio>
struct Lifetime { const char* name; Lifetime(const char* n):name(n){std::printf("%s+|",name);} ~Lifetime(){std::printf("%s-|",name);} };
Lifetime global("global");
int main(){static Lifetime singleton("static");Lifetime local("local");std::printf("main|");}
`},
  {name:'C++ OOP GLUT Game deque, virtual entities and static member display',language:'cpp',active:true,expected:'game=42;global=1;static=1;destroyed=0',size:[96,96],pixel:[255,0,0,255],source:`#include <GL/glut.h>
#include <cassert>
#include <cstdio>
#include <deque>
#include <memory>
int constructed=0,destroyed=0;
struct Lifetime { Lifetime(){++constructed;} ~Lifetime(){++destroyed;} };
Lifetime global;
struct Entity { virtual ~Entity()=default; virtual void draw()const=0; };
struct Snake: Entity { void draw()const override {glColor3f(1,0,0);glBegin(GL_QUADS);glVertex2f(-.7f,-.7f);glVertex2f(.7f,-.7f);glVertex2f(.7f,.7f);glVertex2f(-.7f,.7f);glEnd();} };
class Game {
  std::deque<std::unique_ptr<Entity>> entities;
  bool reported=false;
public:
  inline static Game* current=nullptr;
  Game(){entities.push_back(std::make_unique<Snake>());}
  void display(){
    assert(constructed==2 && destroyed==0 && entities.size()==1);
    glClear(GL_COLOR_BUFFER_BIT);for(const auto& entity:entities)entity->draw();glFlush();
    if(!reported){std::puts("game=42;global=1;static=1;destroyed=0");reported=true;}
  }
  static void displayCallback(){current->display();}
};
int main(int argc,char** argv){
  static Lifetime singleton;static Game game;Game::current=&game;
  glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("OOP Game");
  glutDisplayFunc(Game::displayCallback);glutMainLoop();assert(false);
}`},
  {name:'C++ OOP GLUT captureless display, keyboard, special, mouse and timer lambdas',language:'cpp',active:true,expected:'lambda-timer=7;special=100;exception=caught',size:[96,96],pixel:[255,0,0,255],inputPixel:[0,255,0,255],mousePixel:[0,0,255,255],source:`#include <GL/glut.h>
#include <emscripten.h>
#include <cassert>
#include <cstdio>
#include <stdexcept>
class Game {
  int color=0;
public:
  inline static Game* current=nullptr;
  int timer=0,special=0;
  void display(){glClearColor(color==0,color==1,color==2,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();}
  void key(unsigned char k,int,int){if(k=='a'){color=1;glutPostRedisplay();}}
  void arrow(int key,int,int){special=key;}
  void mouse(int button,int state,int x,int y){if(button==GLUT_LEFT_BUTTON && state==GLUT_DOWN){std::printf("mouse=%d,%d\\n",x,y);color=2;glutPostRedisplay();}}
  void tick(int v){timer=v;try{throw std::runtime_error("tick");}catch(const std::exception&){assert(special==GLUT_KEY_LEFT);std::printf("lambda-timer=%d;special=%d;exception=caught\\n",timer,special);}}
};
int main(int argc,char** argv){
  static Game game;Game::current=&game;glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("OOP lambdas");
  glutDisplayFunc([](){Game::current->display();});
  glutKeyboardFunc([](unsigned char k,int x,int y){Game::current->key(k,x,y);});
  glutSpecialFunc([](int k,int x,int y){Game::current->arrow(k,x,y);});
  glutMouseFunc([](int b,int s,int x,int y){Game::current->mouse(b,s,x,y);});
  glutTimerFunc(100,[](int v){Game::current->tick(v);},7);
  // Send a real DOM key event through upstream GLUT, after its handlers install.
  EM_ASM({setTimeout(function(){Module.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',code:'ArrowLeft',keyCode:37,which:37,bubbles:true,cancelable:true}));},10);});
  glutMainLoop();assert(false);
}`},
  // Shutdown destroys GL4ES's context, so assert cleanup output rather than a
  // post-exit canvas size or pixel. Live drawing is covered by the cases above.
  {name:'C++ OOP GLUT forced runtime exit runs static destructors without unwinding main',language:'cpp',active:true,expected:'shutdown=static-,global-;stack=0',source:`#include <GL/glut.h>
#include <emscripten.h>
#include <cassert>
#include <cstdio>
#include <cstdlib>
int constructed=0,stackDestroyed=0,staticDestroyed=0;
struct Global {Global(){++constructed;}~Global(){assert(staticDestroyed==1 && stackDestroyed==0);std::puts("shutdown=static-,global-;stack=0");}} global;
struct Static {Static(){++constructed;}~Static(){++staticDestroyed;}};
struct Stack {~Stack(){++stackDestroyed;}};
int main(int argc,char** argv){
  static Static singleton;Stack stack;assert(constructed==2);
  glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("OOP shutdown");
  glutDisplayFunc([](){glClearColor(0,1,0,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();});
  glutTimerFunc(500,[](int){assert(stackDestroyed==0 && staticDestroyed==0);emscripten_force_exit(0);},0);
  glutMainLoop();assert(false);
}`},
  {name:'C++ OOP GLUT std exit respects browser keepalive and defers static cleanup',language:'cpp',active:true,expected:'std-exit=kept-alive;static-destroyed=0',size:[96,96],pixel:[0,0,255,255],source:`#include <GL/glut.h>
#include <cassert>
#include <cstdio>
#include <cstdlib>
int constructed=0,destroyed=0;
struct Lifetime {Lifetime(){++constructed;}~Lifetime(){++destroyed;}} global;
int main(int argc,char** argv){
  static Lifetime singleton;assert(constructed==2);
  glutInit(&argc,argv);glutInitDisplayMode(GLUT_SINGLE|GLUT_RGB);glutInitWindowSize(96,96);glutCreateWindow("OOP keepalive");
  glutDisplayFunc([](){glClearColor(0,0,1,1);glClear(GL_COLOR_BUFFER_BIT);glFlush();});
  glutTimerFunc(100,[](int){std::exit(0);},0);
  glutTimerFunc(300,[](int){assert(destroyed==0);std::puts("std-exit=kept-alive;static-destroyed=0");},0);
  glutMainLoop();assert(false);
}`}
];

// Negative fixtures need a compile-failure runner, whereas merged integration's
// cases require successful artifacts. Run this exported check with an initialized
// editor Compiler, then continue compiling to also check error recovery.
export async function runCppOopDiagnostics(compiler) {
  const cases = [
    {name:'private member access',pattern:/private member/,source:'class Game { int score=42; };\nint main(){Game g;return g.score;}'},
    {name:'protected member access',pattern:/protected member/,source:'class Game { protected: int score=42; };\nint main(){Game g;return g.score;}'},
    {name:'abstract class instantiation',pattern:/abstract class/,source:'struct Entity {virtual void draw()=0;};\nint main(){Entity e;}'},
    {name:'invalid override',pattern:/override.*(does not override|hides)|does not override/,source:'struct Base {virtual void tick(int){};};\nstruct Game:Base {void tick() override {}};\nint main(){}'},
    {name:'class syntax location',pattern:/expected ';' after class/,source:'class Game {public: void tick() {} }\nint main(){Game g;g.tick();}'}
  ];
  const results=[];
  for(const test of cases) {
    const start=performance.now();let error;
    try {await compiler.compile(test.source,{language:'cpp'});} catch(value) {error=value;}
    const diagnostics=error?.diagnostics??error?.message??'';
    const pass=!!error && test.pattern.test(diagnostics) && /input\.cpp:\d+:\d+: error:/.test(diagnostics);
    results.push({name:test.name,status:pass?'pass':'fail',elapsedMs:performance.now()-start,source:test.source,diagnostics});
  }
  return results;
}
